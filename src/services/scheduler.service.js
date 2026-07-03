import Job from "../models/job.model.js";
import JobStep from "../models/jobStep.model.js";
import Machine from "../models/machine.model.js";
import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import WorkConfig from "../models/workConfig.model.js";
import Holiday from "../models/holiday.model.js";

class SchedulerService {
  // Helpers
  getDayTime(date, timeStr) {
    const [h, m] = timeStr.split(":").map(Number);

    const d = new Date(date);
    d.setHours(h, m, 0, 0);

    return d;
  }

  isHoliday(date, holidays) {
    return holidays.some(
      (h) => new Date(h.date).toDateString() === date.toDateString(),
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
    const next = new Date(date);

    next.setDate(next.getDate() + 1);

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

  async hasMachineConflict(
    machineId,
    startTime,
    endTime,
    reservedMachines = [],
  ) {
    const dbConflict = await ProductionSlot.findOne({
      machineId,
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

  //Find the first free slot on a machine
  async findMachineSlot(
    machineId,
    desiredStart,
    durationSeconds,
    config,
    holidays,
    reservedMachines = [],
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
      );

      if (!conflict) {
        return {
          startTime: start,
          endTime: end,
        };
      }

      // Machine busy.
      // Try again immediately after it becomes free.
      start = new Date(conflict.plannedEndTime.getTime() + 1000);
    }
  }

  //Find the best machine
  async findBestMachine(
    process,
    desiredStart,
    durationSeconds,
    locationId,
    config,
    holidays,
    reservedMachines = [],
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

  //Worker Conflict

  async hasWorkerConflict(workerId, startTime, endTime, reservedWorkers = []) {
    const dbConflict = await ProductionSlot.findOne({
      "workers.workerId": workerId,
      plannedStartTime: { $lt: endTime },
      plannedEndTime: { $gt: startTime },
    });

    if (dbConflict) {
      return true;
    }

    return reservedWorkers.some(
      (w) =>
        w.workerId.toString() === workerId.toString() &&
        w.startTime < endTime &&
        w.endTime > startTime,
    );
  }

  //Get Available Workers

  async getAvailableWorkers(
    machine,
    startTime,
    endTime,
    requiredManpower,
    locationId,
    reservedWorkers = [],
  ) {
    if (!machine?.requiredSkills?.length) {
      return [];
    }

    // normalize to strings — workers store skills as strings, machine has ObjectIds
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
  //Reserve Workers
  createWorkerAssignments(workers) {
    return workers.map((worker) => ({
      workerId: worker._id,
      effort: 100,
    }));
  }

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

    // Earliest we could possibly start: later of (right now)

    const baseStart = this.normalizeWorkingTime(new Date(), config, holidays);

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

      // IMPORTANT: use actual scheduled start, not desiredStart
      // If the machine was busy and got pushed forward, prevStepStart
      // reflects where it actually landed — so step 2's desiredStart
      // is correctly one cycle after step 1's real start
      prevStepStart = machineResult.startTime;
      prevCycleTime = cycleTimeSec;
    }

    return schedule;
  }
}

export default new SchedulerService();
