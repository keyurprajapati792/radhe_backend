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

  // ── CHANGED: renamed from computeWorkingSegments. Now only closes a
  // segment when the CALENDAR DAY actually changes (overnight or a
  // holiday skip) — a break within the same working day no longer ends
  // a segment, it's just absorbed into it like addWorkingSeconds already
  // does. This is what decides how many ProductionSlot docs a step gets:
  // one per real working day, not one per break-free stretch. ─────────
  computeDaySegments(startTime, seconds, config, holidays) {
    const dayKeyOf = (d) =>
      DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).toISODate();

    let current = new Date(startTime);
    let remaining = seconds;
    const segments = [];

    let segmentStart = null;
    let segmentDayKey = null;
    let lastPoint = null;

    while (remaining > 0) {
      current = this.normalizeWorkingTime(current, config, holidays);
      const dayKey = dayKeyOf(current);

      if (segmentStart === null) {
        segmentStart = new Date(current);
        segmentDayKey = dayKey;
      } else if (dayKey !== segmentDayKey) {
        // a real day boundary was crossed (overnight or holiday skip) —
        // close the segment here. A break landing us later the same day
        // never reaches this branch, since dayKey stays identical.
        segments.push({ startTime: segmentStart, endTime: lastPoint });
        segmentStart = new Date(current);
        segmentDayKey = dayKey;
      }

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
        lastPoint = new Date(current.getTime() + remaining * 1000);
        segments.push({ startTime: segmentStart, endTime: lastPoint });
        return segments;
      }

      remaining -= available;
      lastPoint = new Date(segmentEnd.getTime());
      current = new Date(segmentEnd.getTime() + 1000);
    }

    return segments;
  }

  // ── UNCHANGED ──────────────────────────────────────────────────
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

  // ── UNCHANGED ──────────────────────────────────────────────────
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

  // ── UNCHANGED ──────────────────────────────────────────────────
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

  // ── UNCHANGED ──────────────────────────────────────────────────
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

  // ── UNCHANGED — still takes an explicit startTime/endTime window, so
  // calling it once per day-segment (instead of once for the whole
  // multi-day span) is all that's needed to get independent per-day
  // worker search; nothing inside this function changes. ─────────────
  async getAvailableWorkers(
    startTime,
    endTime,
    manpowerRequirements,
    locationId,
    reservedWorkers = [],
    onlyRunning = false,
  ) {
    if (!manpowerRequirements?.length) {
      return [];
    }

    const workers = await Worker.find({
      locationId,
      status: { $nin: ["leave", "terminated"] },
    });

    const usedWorkerIds = new Set(); // one worker can't fill two rows in the same step
    const assignments = [];

    for (const requirement of manpowerRequirements) {
      const skillId = requirement.skillId.toString();
      const needed = requirement.count;

      const candidates = workers.filter(
        (w) =>
          !usedWorkerIds.has(w._id.toString()) &&
          w.skills?.some((s) => s.toString() === skillId),
      );

      let filled = 0;

      for (const worker of candidates) {
        if (filled >= needed) break;

        const conflict = await this.hasWorkerConflict(
          worker._id,
          startTime,
          endTime,
          reservedWorkers,
          onlyRunning,
        );

        if (!conflict) {
          usedWorkerIds.add(worker._id.toString());
          assignments.push({
            worker,
            skillId: requirement.skillId,
            effort: requirement.effort,
          });
          filled++;
        }
      }

      // Record the shortfall per-skill rather than silently under-filling
      for (let i = filled; i < needed; i++) {
        assignments.push({
          worker: null,
          skillId: requirement.skillId,
          effort: requirement.effort,
          missing: true,
        });
      }
    }

    return assignments;
  }

  // ── UNCHANGED ──────────────────────────────────────────────────
  createWorkerAssignments(assignments) {
    return assignments
      .filter((a) => a.worker)
      .map((a) => ({
        workerId: a.worker._id,
        skillId: a.skillId,
        effort: a.effort,
      }));
  }

  // ── UNCHANGED ──────────────────────────────────────────────────
  manpowerCounts(manpowerRequirements, assignments) {
    const needed = (manpowerRequirements || []).reduce(
      (sum, r) => sum + r.count,
      0,
    );
    const filled = assignments.filter((a) => a.worker).length;
    return { needed, filled };
  }

  // ── CHANGED: the machine is still found/reserved once for the FULL
  // multi-day span (unchanged findBestMachine call), but the step now
  // gets one ProductionSlot per calendar working day it touches, each
  // with its own independently-searched worker assignment. ───────────
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

      reservedMachines.push({
        machineId: machineResult.machine._id,
        startTime: machineResult.startTime,
        endTime: machineResult.endTime,
      });

      // NEW: split the machine's full span into per-day working segments
      const daySegments = this.computeDaySegments(
        machineResult.startTime,
        durationSec,
        config,
        holidays,
      );

      // NEW: one ProductionSlot per day segment. Workers are searched
      // independently for each day — a worker filling today's portion
      // may not be free tomorrow, so a different one can be picked for
      // the next day's slot. Each slot also gets its own
      // producedQty/rejectQty/reworkQty/approvedQty for shopfloor
      // reporting per day.
      const segmentSlots = [];
      let stepUnderstaffed = false;
      let understaffedInfo = null;

      for (let segIndex = 0; segIndex < daySegments.length; segIndex++) {
        const seg = daySegments[segIndex];

        const assignments = await this.getAvailableWorkers(
          seg.startTime,
          seg.endTime,
          step.processId.manpowerRequirements,
          locationId,
          reservedWorkers,
        );

        const { needed, filled } = this.manpowerCounts(
          step.processId.manpowerRequirements,
          assignments,
        );

        if (filled < needed && !stepUnderstaffed) {
          stepUnderstaffed = true;
          understaffedInfo = { segIndex, needed, filled };
        }

        for (const a of assignments.filter((x) => x.worker)) {
          reservedWorkers.push({
            workerId: a.worker._id,
            startTime: seg.startTime,
            endTime: seg.endTime,
          });
        }

        const slotDoc = await ProductionSlot.findOneAndUpdate(
          { jobStepId: step._id, segmentIndex: segIndex },
          {
            jobId: job._id,
            jobStepId: step._id,
            segmentIndex: segIndex,
            machineId: machineResult.machine._id,
            workers: this.createWorkerAssignments(assignments),
            plannedStartTime: seg.startTime,
            plannedEndTime: seg.endTime,
            status: "pending",
          },
          { upsert: true, new: true },
        );

        segmentSlots.push(slotDoc);
      }

      // NEW: drop any leftover day-slots from a previous run that had
      // more days than this run needs (e.g. quantity was reduced)
      await ProductionSlot.deleteMany({
        jobStepId: step._id,
        segmentIndex: { $gte: daySegments.length },
      });

      if (stepUnderstaffed) {
        throw new Error(
          `Not enough workers for: ${step.processId.name} on day ${
            understaffedInfo.segIndex + 1
          }. Need ${understaffedInfo.needed}, found ${understaffedInfo.filled}`,
        );
      }

      schedule.push({
        jobStep: step,
        machine: machineResult.machine,
        segments: segmentSlots,
        plannedStartTime: machineResult.startTime,
        plannedEndTime: machineResult.endTime,
      });

      await JobStep.findByIdAndUpdate(step._id, { status: "pending" });

      prevStepStart = machineResult.startTime;
      prevCycleTime = cycleTimeSec;
    }

    return schedule;
  }

  // ── CHANGED: same per-day-segment slot creation as scheduleJob,
  // grafted onto the priority-aware rebuild. A step is now considered
  // "in-flight" if ANY of its day-segments is running; when that's the
  // case the whole step is frozen (same as before), sourcing the freeze
  // floor from the LAST segment's planned end (the full step's end),
  // not just the running segment's end. ──────────────────────────────
  async rebuildSchedule(locationId) {
    const config = await WorkConfig.findOne({ locationId });
    if (!config) throw new Error("Work configuration not found");

    const holidays = await Holiday.find({ locationId });

    const now = new Date();
    const baseStart = this.normalizeWorkingTime(now, config, holidays);

    const jobs = await Job.find({
      locationId,
      status: { $nin: ["completed", "cancelled"] },
    }).sort({ priority: 1, orderDate: 1, createdAt: 1 });

    if (!jobs.length) {
      return { success: true, shifted: [], issues: [] };
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
    const issues = [];

    for (const job of jobs) {
      const jobSteps = (stepsByJob.get(job._id.toString()) || []).sort(
        (a, b) => a.sequence - b.sequence,
      );

      let prevStepStart = null;
      let prevCycleTime = null;
      let jobFreezeFloor = baseStart;

      for (const step of jobSteps) {
        const stepSlots = (slotsByStep.get(step._id.toString()) || []).sort(
          (a, b) => a.segmentIndex - b.segmentIndex,
        );
        const cycleTimeSec = step.processId.cycleTime;

        // NEW: a step maps to N day-segment slots now. If any of them is
        // running, freeze the whole step — same behavior as before, just
        // sourcing the freeze floor from the LAST segment's planned end
        // (the full multi-day step's end) instead of a single doc.
        const runningSeg = stepSlots.find((s) => s.status === "running");

        if (runningSeg) {
          const lastSeg = stepSlots[stepSlots.length - 1];
          prevStepStart =
            runningSeg.actualStartTime || runningSeg.plannedStartTime;
          prevCycleTime = cycleTimeSec;
          jobFreezeFloor = lastSeg.plannedEndTime;
          continue;
        }

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
          true,
        );

        if (!machineResult) {
          issues.push({
            jobId: job._id,
            jobRef: job.ref_code,
            step: step.processId.name,
            sequence: step.sequence,
            reason: "no_machine_available",
          });
          continue;
        }

        reservedMachines.push({
          machineId: machineResult.machine._id,
          startTime: machineResult.startTime,
          endTime: machineResult.endTime,
        });

        // NEW: split into per-day segments
        const daySegments = this.computeDaySegments(
          machineResult.startTime,
          durationSec,
          config,
          holidays,
        );

        const existingPending = stepSlots.filter((s) => s.status === "pending");

        for (let segIndex = 0; segIndex < daySegments.length; segIndex++) {
          const seg = daySegments[segIndex];

          // NEW: independent worker search per day-segment
          const assignments = await this.getAvailableWorkers(
            seg.startTime,
            seg.endTime,
            step.processId.manpowerRequirements,
            locationId,
            reservedWorkers,
            true,
          );

          const { needed, filled } = this.manpowerCounts(
            step.processId.manpowerRequirements,
            assignments,
          );

          const understaffed = filled < needed;
          if (understaffed) {
            issues.push({
              jobId: job._id,
              jobRef: job.ref_code,
              step: step.processId.name,
              sequence: step.sequence,
              segmentIndex: segIndex,
              reason: "insufficient_workers",
              needed,
              found: filled,
            });
          }

          for (const a of assignments.filter((x) => x.worker)) {
            reservedWorkers.push({
              workerId: a.worker._id,
              startTime: seg.startTime,
              endTime: seg.endTime,
            });
          }

          await ProductionSlot.findOneAndUpdate(
            {
              jobStepId: step._id,
              segmentIndex: segIndex,
              status: "pending",
            },
            {
              jobId: job._id,
              jobStepId: step._id,
              segmentIndex: segIndex,
              machineId: machineResult.machine._id,
              workers: this.createWorkerAssignments(assignments),
              plannedStartTime: seg.startTime,
              plannedEndTime: seg.endTime,
              status: "pending",
              needsAttention: understaffed,
              shortfall: understaffed ? needed - filled : 0,
            },
            { upsert: true, new: true },
          );
        }

        // NEW: drop stale pending day-slots left over from a previous
        // run that had more days than this run needs
        await ProductionSlot.deleteMany({
          jobStepId: step._id,
          status: "pending",
          segmentIndex: { $gte: daySegments.length },
        });

        if (
          existingPending[0] &&
          new Date(existingPending[0].plannedStartTime).getTime() !==
            machineResult.startTime.getTime()
        ) {
          shifted.push({
            jobId: job._id,
            jobRef: job.ref_code,
            step: step.processId.name,
            from: existingPending[0].plannedStartTime,
            to: machineResult.startTime,
          });
        }

        await JobStep.findByIdAndUpdate(step._id, { status: "pending" });

        prevStepStart = machineResult.startTime;
        prevCycleTime = cycleTimeSec;
      }
    }

    return { success: true, shifted, issues };
  }
}

export default new SchedulerService();
