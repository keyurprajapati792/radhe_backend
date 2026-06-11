import Job from "../models/job.model.js";
import JobStep from "../models/jobStep.model.js";
import Machine from "../models/machine.model.js";
import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import WorkConfig from "../models/workConfig.model.js";
import Holiday from "../models/holiday.model.js";

class SchedulerService {
  // =========================================================
  // HELPERS
  // =========================================================

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

    if (config.overtime?.enabled && config.overtime?.end) {
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

  // =========================================================
  // CONVERT PROCESS TIME
  // =========================================================

  /**
   * cycleTime is stored in SECONDS
   * quantity * cycleTime => total seconds
   * convert seconds to minutes
   */
  calculateEstimatedSeconds(cycleTimeSeconds, quantity) {
    return cycleTimeSeconds * quantity;
  }
  // =========================================================
  // FAST WORKING SECONDS ENGINE
  // =========================================================

  addWorkingSeconds(startTime, seconds, config, holidays) {
    let current = new Date(startTime);
    let remaining = seconds;

    while (remaining > 0) {
      current = this.normalizeWorkingTime(current, config, holidays);

      const dayEnd =
        config.overtime?.enabled && config.overtime?.end
          ? this.getDayTime(current, config.overtime.end)
          : this.getDayTime(current, config.workingHours.end);

      let nextBreakStart = null;

      for (const b of config.breaks || []) {
        const breakStart = this.getDayTime(current, b.start);

        if (breakStart > current) {
          if (!nextBreakStart || breakStart < nextBreakStart) {
            nextBreakStart = breakStart;
          }
        }
      }

      let segmentEnd = dayEnd;

      if (nextBreakStart && nextBreakStart < segmentEnd) {
        segmentEnd = nextBreakStart;
      }

      const availableSeconds = Math.floor((segmentEnd - current) / 1000);

      if (availableSeconds <= 0) {
        current = new Date(segmentEnd.getTime() + 1000);
        continue;
      }

      if (remaining <= availableSeconds) {
        return new Date(current.getTime() + remaining * 1000);
      }

      remaining -= availableSeconds;

      current = new Date(segmentEnd.getTime() + 1000);
    }

    return current;
  }

  // =========================================================
  // MACHINE CONFLICTS
  // =========================================================

  async hasMachineConflict(machineId, startTime, endTime) {
    return ProductionSlot.findOne({
      machineId,

      startTime: {
        $lt: endTime,
      },

      endTime: {
        $gt: startTime,
      },
    }).sort({ endTime: 1 });
  }

  async getMachineAvailableSlot(
    machineId,
    desiredStart,
    durationSeconds,
    config,
    holidays,
  ) {
    let currentStart = new Date(desiredStart);

    while (true) {
      currentStart = this.normalizeWorkingTime(currentStart, config, holidays);

      const calculatedEnd = this.addWorkingSeconds(
        currentStart,
        durationSeconds,
        config,
        holidays,
      );

      const conflict = await this.hasMachineConflict(
        machineId,
        currentStart,
        calculatedEnd,
      );

      if (!conflict) {
        return {
          processStartTime: currentStart,
          processEndTime: calculatedEnd,
        };
      }

      currentStart = new Date(conflict.endTime.getTime() + 1000);
    }
  }

  // =========================================================
  // WORKERS
  // =========================================================

  async getAvailableWorkers(
    machine,
    startTime,
    endTime,
    requiredManpower,
    locationId,
  ) {
    if (!machine?.requiredSkills?.length) {
      return [];
    }

    const workers = await Worker.find({
      skills: {
        $in: machine.requiredSkills,
      },

      status: "available",

      locationId,
    });

    const availableWorkers = [];

    for (const worker of workers) {
      const conflict = await ProductionSlot.findOne({
        "workers.workerId": worker._id,

        startTime: {
          $lt: endTime,
        },

        endTime: {
          $gt: startTime,
        },
      });

      if (!conflict) {
        availableWorkers.push(worker);
      }

      if (availableWorkers.length >= requiredManpower) {
        break;
      }
    }

    return availableWorkers;
  }

  // =========================================================
  // MAIN
  // =========================================================

  async getSuggestions(jobStepId, locationId) {
    const jobStep = await JobStep.findById(jobStepId).populate("processId");

    if (!jobStep) {
      throw new Error("Job step not found");
    }

    const job = await Job.findById(jobStep.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    // =====================================================
    // CONFIG
    // =====================================================

    const config = await WorkConfig.findOne({
      locationId,
    });

    if (!config) {
      throw new Error("Work config not found");
    }

    const holidays = await Holiday.find({
      locationId,
    });

    // =====================================================
    // CALCULATE ACTUAL TIME
    // =====================================================

    const estimatedSeconds = this.calculateEstimatedSeconds(
      jobStep.processId.cycleTime,
      job.quantity,
    );

    // update latest estimate
    await JobStep.findByIdAndUpdate(jobStep._id, {
      totalEstimatedTime: estimatedSeconds,
    });

    // =====================================================
    // PREVIOUS STEP END
    // =====================================================

    let previousStepEnd = this.normalizeWorkingTime(
      new Date(),
      config,
      holidays,
    );

    if (jobStep.sequence > 1) {
      const previousStep = await JobStep.findOne({
        jobId: jobStep.jobId,
        sequence: jobStep.sequence - 1,
      });

      if (previousStep?.plannedEndTime) {
        previousStepEnd = new Date(previousStep.plannedEndTime);
      }
    }

    // =====================================================
    // FIND MACHINES
    // =====================================================

    const machines = await Machine.find({
      _id: {
        $in: jobStep.processId.machineIds || [],
      },
    });

    if (!machines.length) {
      return {
        process: jobStep.processId,
        machine: null,
        workers: [],
        processStartTime: null,
        processEndTime: null,
        requiredManpower: jobStep.requiredManpower,
      };
    }

    // =====================================================
    // PICK BEST MACHINE
    // =====================================================

    let selectedMachine = null;

    let selectedStart = null;

    let selectedEnd = null;

    for (const machine of machines) {
      const slot = await this.getMachineAvailableSlot(
        machine._id,
        previousStepEnd,
        estimatedSeconds,
        config,
        holidays,
      );

      if (!selectedStart || slot.processStartTime < selectedStart) {
        selectedMachine = machine;

        selectedStart = slot.processStartTime;

        selectedEnd = slot.processEndTime;
      }
    }

    // =====================================================
    // WORKERS
    // =====================================================

    const workers = await this.getAvailableWorkers(
      selectedMachine,
      selectedStart,
      selectedEnd,
      jobStep.requiredManpower,
      locationId,
    );

    // =====================================================
    // SAVE PLANNED TIMES
    // =====================================================

    await JobStep.findByIdAndUpdate(jobStep._id, {
      plannedStartTime: selectedStart,
      plannedEndTime: selectedEnd,
      totalEstimatedTime: estimatedSeconds,
    });

    return {
      process: jobStep.processId,
      machine: selectedMachine,
      workers,
      processStartTime: selectedStart,
      processEndTime: selectedEnd,
      requiredManpower: jobStep.requiredManpower,
      estimatedSeconds,
    };
  }
}

export default new SchedulerService();
