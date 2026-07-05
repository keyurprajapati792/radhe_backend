import Job from "../models/job.model.js";
import JobStep from "../models/jobStep.model.js";
import Machine from "../models/machine.model.js";
import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import WorkConfig from "../models/workConfig.model.js";
import Holiday from "../models/holiday.model.js";

import { DateTime } from "luxon";

const APP_TIMEZONE = "Asia/Kolkata";

class SchedulerService {
  // Helpers
  getDayTime(date, timeStr) {
    const [h, m] = timeStr.split(":").map(Number);

    const dt = DateTime.fromJSDate(date, { zone: APP_TIMEZONE }).set({
      hour: h,
      minute: m,
      second: 0,
      millisecond: 0,
    });

    return dt.toJSDate();
  }

  isHoliday(date, holidays) {
    const dayKey = DateTime.fromJSDate(date, {
      zone: APP_TIMEZONE,
    }).toISODate();

    return holidays.some(
      (h) =>
        DateTime.fromJSDate(new Date(h.date), {
          zone: APP_TIMEZONE,
        }).toISODate() === dayKey,
    );
  }

  isWithinWorkingHours(date, config) {
    const start = this.getDayTime(date, config.workingHours.start);
    let end = this.getDayTime(date, config.workingHours.end);

    if (config.overtime?.enabled) {
      end = this.getDayTime(date, config.overtime.end);
    }

    return date >= start && date < end;
  }

  isBreakTime(date, breaks) {
    return breaks.some((b) => {
      const start = this.getDayTime(date, b.start);
      const end = this.getDayTime(date, b.end);
      return date >= start && date < end;
    });
  }

  moveToBreakEnd(date, breaks) {
    for (const b of breaks) {
      const start = this.getDayTime(date, b.start);
      const end = this.getDayTime(date, b.end);

      if (date >= start && date < end) {
        return end;
      }
    }

    return date;
  }

  moveToNextWorkingStart(date, config) {
    const next = DateTime.fromJSDate(date, { zone: APP_TIMEZONE })
      .plus({ days: 1 })
      .toJSDate();

    return this.getDayTime(next, config.workingHours.start);
  }

  normalizeWorkingTime(date, config, holidays) {
    let current = new Date(date);

    while (true) {
      if (this.isHoliday(current, holidays)) {
        current = this.moveToNextWorkingStart(current, config);
        continue;
      }

      if (!this.isWithinWorkingHours(current, config)) {
        const workStart = this.getDayTime(current, config.workingHours.start);

        if (current < workStart) {
          current = workStart;
        } else {
          current = this.moveToNextWorkingStart(current, config);
        }

        continue;
      }

      if (this.isBreakTime(current, config.breaks)) {
        current = this.moveToBreakEnd(current, config.breaks);
        continue;
      }

      break;
    }

    return current;
  }

  //Time Engine
  calculateDuration(process, quantity) {
    return process.cycleTime * quantity;
  }

  addWorkingSeconds(startTime, seconds, config, holidays) {
    let current = new Date(startTime);
    let remaining = seconds;

    while (remaining > 0) {
      current = this.normalizeWorkingTime(current, config, holidays);

      const dayEnd = config.overtime?.enabled
        ? this.getDayTime(current, config.overtime.end)
        : this.getDayTime(current, config.workingHours.end);

      let nextBreak = null;

      for (const b of config.breaks || []) {
        const breakStart = this.getDayTime(current, b.start);

        if (breakStart > current) {
          if (!nextBreak || breakStart < nextBreak) {
            nextBreak = breakStart;
          }
        }
      }

      let segmentEnd = dayEnd;

      if (nextBreak && nextBreak < segmentEnd) {
        segmentEnd = nextBreak;
      }

      const available = Math.floor((segmentEnd - current) / 1000);

      if (available <= 0) {
        current = new Date(segmentEnd.getTime() + 1000);
        continue;
      }

      if (remaining <= available) {
        return new Date(current.getTime() + remaining * 1000);
      }

      remaining -= available;
      current = new Date(segmentEnd.getTime() + 1000);
    }

    return current;
  }

  // ── CHANGED: added `onlyRunning` param ──────────────────────────
  // During a priority rebuild, pending slots are exactly what's being
  // recomputed — they're not real conflicts. Only running slots are.
  // Default stays false so scheduleJob's existing behavior is untouched.
  async hasMachineConflict(
    machineId,
    startTime,
    endTime,
    reservedMachines = [],
    onlyRunning = false,
  ) {
    const dbConflict = await ProductionSlot.findOne({
      machineId,
      ...(onlyRunning ? { status: "running" } : {}),
      plannedStartTime: { $lt: endTime },
      plannedEndTime: { $gt: startTime },
    }).sort({
      plannedEndTime: 1,
    });

    if (dbConflict) {
      return dbConflict;
    }

    const memoryConflict = reservedMachines.find(
      (m) =>
        m.machineId.toString() === machineId.toString() &&
        m.startTime < endTime &&
        m.endTime > startTime,
    );

    if (memoryConflict) {
      return {
        plannedEndTime: memoryConflict.endTime,
      };
    }

    return null;
  }

  // ── CHANGED: threads `onlyRunning` through ──────────────────────
  async findMachineSlot(
    machineId,
    desiredStart,
    durationSeconds,
    config,
    holidays,
    reservedMachines = [],
    onlyRunning = false,
  ) {
    let start = new Date(desiredStart);

    while (true) {
      start = this.normalizeWorkingTime(start, config, holidays);

      const end = this.addWorkingSeconds(
        start,
        durationSeconds,
        config,
        holidays,
      );

      const conflict = await this.hasMachineConflict(
        machineId,
        start,
        end,
        reservedMachines,
        onlyRunning,
      );

      if (!conflict) {
        return { startTime: start, endTime: end };
      }

      start = new Date(conflict.plannedEndTime.getTime() + 1000);
    }
  }

  // ── CHANGED: threads `onlyRunning` through ──────────────────────
  async findBestMachine(
    process,
    desiredStart,
    durationSeconds,
    locationId,
    config,
    holidays,
    reservedMachines = [],
    onlyRunning = false,
  ) {
    const machines = await Machine.find({
      name: process.requiredMachineType,
      status: { $nin: ["maintenance"] },
      locationId,
    });

    if (!machines.length) {
      return null;
    }

    let best = null;

    for (const machine of machines) {
      const slot = await this.findMachineSlot(
        machine._id,
        desiredStart,
        durationSeconds,
        config,
        holidays,
        reservedMachines,
        onlyRunning,
      );

      if (!best || slot.startTime < best.startTime) {
        best = {
          machine,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      }
    }

    return best;
  }

  // ── CHANGED: added `onlyRunning` param ──────────────────────────
  async hasWorkerConflict(
    workerId,
    startTime,
    endTime,
    reservedWorkers = [],
    onlyRunning = false,
  ) {
    const dbConflict = await ProductionSlot.findOne({
      "workers.workerId": workerId,
      ...(onlyRunning ? { status: "running" } : {}),
      plannedStartTime: { $lt: endTime },
      plannedEndTime: { $gt: startTime },
    }).sort({ plannedEndTime: 1 });

    if (dbConflict) return dbConflict; // return the doc, not just true

    const memoryConflict = reservedWorkers.find(
      (w) =>
        w.workerId.toString() === workerId.toString() &&
        w.startTime < endTime &&
        w.endTime > startTime,
    );

    return memoryConflict ? { plannedEndTime: memoryConflict.endTime } : null;
  }

  // ── CHANGED: threads `onlyRunning` through ──────────────────────
  async getAvailableWorkers(
    machine,
    startTime,
    endTime,
    requiredManpower,
    locationId,
    reservedWorkers = [],
    onlyRunning = false,
  ) {
    if (!machine?.requiredSkills?.length) {
      return [];
    }

    const skillIds = machine.requiredSkills.map((s) => s.toString());

    const workers = await Worker.find({
      locationId,
      status: { $nin: ["leave", "terminated"] },
    });

    const skillMatched = workers.filter((w) =>
      w.skills?.some((s) => skillIds.includes(s.toString())),
    );

    const available = [];

    for (const worker of skillMatched) {
      const conflict = await this.hasWorkerConflict(
        worker._id,
        startTime,
        endTime,
        reservedWorkers,
        onlyRunning,
      );

      if (!conflict) {
        available.push(worker);
      }
      if (available.length >= requiredManpower) {
        break;
      }
    }

    return available;
  }

  createWorkerAssignments(workers) {
    return workers.map((worker) => ({
      workerId: worker._id,
      effort: 100,
    }));
  }

  // ── UNCHANGED: kept for reference / any other caller still using it ──
  async scheduleJob(jobId, locationId) {
    const job = await Job.findById(jobId);
    if (!job) throw new Error("Job not found");

    const steps = await JobStep.find({ jobId })
      .populate("processId")
      .sort({ sequence: 1 });
    if (!steps.length) throw new Error("No job steps found");

    const config = await WorkConfig.findOne({ locationId });
    if (!config) throw new Error("Work configuration not found");

    const holidays = await Holiday.find({ locationId });

    const now = new Date();
    const baseStart = this.normalizeWorkingTime(now, config, holidays);

    const schedule = [];
    const reservedMachines = [];
    const reservedWorkers = [];

    let prevStepStart = null;
    let prevCycleTime = null;

    for (const step of steps) {
      const cycleTimeSec = step.processId.cycleTime;

      const desiredStart =
        prevStepStart === null
          ? baseStart
          : this.addWorkingSeconds(
              prevStepStart,
              prevCycleTime,
              config,
              holidays,
            );

      const effectiveCycleTime =
        prevCycleTime === null
          ? cycleTimeSec
          : Math.max(cycleTimeSec, prevCycleTime);

      const durationSec =
        (job.quantity - 1) * effectiveCycleTime + cycleTimeSec;

      const machineResult = await this.findBestMachine(
        step.processId,
        desiredStart,
        durationSec,
        locationId,
        config,
        holidays,
        reservedMachines,
      );

      if (!machineResult) {
        throw new Error(`No machine available for: ${step.processId.name}`);
      }

      const workers = await this.getAvailableWorkers(
        machineResult.machine,
        machineResult.startTime,
        machineResult.endTime,
        step.requiredManpower,
        locationId,
        reservedWorkers,
      );

      if (workers.length < step.requiredManpower) {
        throw new Error(
          `Not enough workers for: ${step.processId.name}. ` +
            `Need ${step.requiredManpower}, found ${workers.length}`,
        );
      }

      schedule.push({
        jobStep: step,
        machine: machineResult.machine,
        workers,
        plannedStartTime: machineResult.startTime,
        plannedEndTime: machineResult.endTime,
      });

      reservedMachines.push({
        machineId: machineResult.machine._id,
        startTime: machineResult.startTime,
        endTime: machineResult.endTime,
      });

      for (const worker of workers) {
        reservedWorkers.push({
          workerId: worker._id,
          startTime: machineResult.startTime,
          endTime: machineResult.endTime,
        });
      }

      await ProductionSlot.findOneAndUpdate(
        { jobStepId: step._id },
        {
          jobId: job._id,
          jobStepId: step._id,
          machineId: machineResult.machine._id,
          workers: this.createWorkerAssignments(workers),
          plannedStartTime: machineResult.startTime,
          plannedEndTime: machineResult.endTime,
          status: "pending",
        },
        { upsert: true, new: true },
      );

      await JobStep.findByIdAndUpdate(step._id, { status: "pending" });

      prevStepStart = machineResult.startTime;
      prevCycleTime = cycleTimeSec;
    }

    return schedule;
  }

  // ── NEW: priority-aware rebuild across the whole location ──────────
  async rebuildSchedule(locationId) {
    const config = await WorkConfig.findOne({ locationId });
    if (!config) throw new Error("Work configuration not found");

    const holidays = await Holiday.find({ locationId });

    const now = new Date();
    const baseStart = this.normalizeWorkingTime(now, config, holidays);

    // Priority ascending = most urgent first (1 = Urgent).
    // Tie-break by orderDate/createdAt so same-priority jobs keep a
    // stable relative order across repeated rebuilds.
    const jobs = await Job.find({
      locationId,
      status: { $nin: ["completed", "cancelled"] },
    }).sort({ priority: 1, orderDate: 1, createdAt: 1 });

    if (!jobs.length) {
      return { success: true, shifted: [] };
    }

    const jobIds = jobs.map((j) => j._id);

    const steps = await JobStep.find({ jobId: { $in: jobIds } })
      .populate("processId")
      .sort({ jobId: 1, sequence: 1 });

    const slots = await ProductionSlot.find({
      jobStepId: { $in: steps.map((s) => s._id) },
    });

    const slotsByStep = new Map();
    for (const slot of slots) {
      const key = slot.jobStepId.toString();
      if (!slotsByStep.has(key)) slotsByStep.set(key, []);
      slotsByStep.get(key).push(slot);
    }

    const pickActiveSlot = (stepSlots = []) =>
      stepSlots.find((s) => s.status === "running") ||
      stepSlots.find((s) => s.status === "pending") ||
      null;

    // Only RUNNING slots are hard, immovable reservations during a rebuild.
    const reservedMachines = [];
    const reservedWorkers = [];

    for (const slot of slots) {
      if (slot.status !== "running") continue;

      reservedMachines.push({
        machineId: slot.machineId,
        startTime: slot.plannedStartTime,
        endTime: slot.plannedEndTime,
      });

      for (const w of slot.workers || []) {
        reservedWorkers.push({
          workerId: w.workerId,
          startTime: slot.plannedStartTime,
          endTime: slot.plannedEndTime,
        });
      }
    }

    const stepsByJob = new Map();
    for (const step of steps) {
      const key = step.jobId.toString();
      if (!stepsByJob.has(key)) stepsByJob.set(key, []);
      stepsByJob.get(key).push(step);
    }

    const shifted = [];

    for (const job of jobs) {
      const jobSteps = (stepsByJob.get(job._id.toString()) || []).sort(
        (a, b) => a.sequence - b.sequence,
      );

      let prevStepStart = null;
      let prevCycleTime = null;
      let jobFreezeFloor = baseStart;

      for (const step of jobSteps) {
        const stepSlots = slotsByStep.get(step._id.toString()) || [];
        const activeSlot = pickActiveSlot(stepSlots);
        const cycleTimeSec = step.processId.cycleTime;

        // Already running — frozen. Seed the pipeline offset from it
        // so this job's remaining pending steps line up correctly,
        // but don't touch its slot.
        if (activeSlot?.status === "running") {
          prevStepStart =
            activeSlot.actualStartTime || activeSlot.plannedStartTime;
          prevCycleTime = cycleTimeSec;
          jobFreezeFloor = activeSlot.plannedEndTime;
          continue;
        }

        // Movable — recompute from scratch. Priority order (jobs loop
        // outer) decides who gets first claim on each machine/worker.
        const desiredStart =
          prevStepStart === null
            ? jobFreezeFloor
            : this.addWorkingSeconds(
                prevStepStart,
                prevCycleTime,
                config,
                holidays,
              );

        const flooredStart =
          desiredStart < jobFreezeFloor ? jobFreezeFloor : desiredStart;

        const effectiveCycleTime =
          prevCycleTime === null
            ? cycleTimeSec
            : Math.max(cycleTimeSec, prevCycleTime);

        const durationSec =
          (job.quantity - 1) * effectiveCycleTime + cycleTimeSec;

        const machineResult = await this.findBestMachine(
          step.processId,
          flooredStart,
          durationSec,
          locationId,
          config,
          holidays,
          reservedMachines,
          true, // onlyRunning — pending slots don't block during rebuild
        );

        if (!machineResult) {
          throw new Error(
            `No machine available for ${job.ref_code} - ${step.processId.name}`,
          );
        }

        const workers = await this.getAvailableWorkers(
          machineResult.machine,
          machineResult.startTime,
          machineResult.endTime,
          step.requiredManpower,
          locationId,
          reservedWorkers,
          true, // onlyRunning
        );

        if (workers.length < step.requiredManpower) {
          throw new Error(
            `Not enough workers for ${job.ref_code} - ${step.processId.name}`,
          );
        }

        reservedMachines.push({
          machineId: machineResult.machine._id,
          startTime: machineResult.startTime,
          endTime: machineResult.endTime,
        });

        for (const worker of workers) {
          reservedWorkers.push({
            workerId: worker._id,
            startTime: machineResult.startTime,
            endTime: machineResult.endTime,
          });
        }

        if (
          activeSlot &&
          new Date(activeSlot.plannedStartTime).getTime() !==
            machineResult.startTime.getTime()
        ) {
          shifted.push({
            jobId: job._id,
            jobRef: job.ref_code,
            step: step.processId.name,
            from: activeSlot.plannedStartTime,
            to: machineResult.startTime,
          });
        }

        await ProductionSlot.findOneAndUpdate(
          { jobStepId: step._id, status: "pending" },
          {
            jobId: job._id,
            jobStepId: step._id,
            machineId: machineResult.machine._id,
            workers: this.createWorkerAssignments(workers),
            plannedStartTime: machineResult.startTime,
            plannedEndTime: machineResult.endTime,
            status: "pending",
          },
          { upsert: true, new: true },
        );

        await JobStep.findByIdAndUpdate(step._id, { status: "pending" });

        prevStepStart = machineResult.startTime;
        prevCycleTime = cycleTimeSec;
      }
    }

    return { success: true, shifted };
  }
}

export default new SchedulerService();
