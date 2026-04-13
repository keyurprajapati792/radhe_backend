import Process from "../models/process.model.js";
import WorkConfig from "../models/workConfig.model.js";
import Holiday from "../models/holiday.model.js";
import JobStep from "../models/jobStep.model.js";

class PlanningService {
  // ---------------- HELPERS ----------------

  isHoliday(date, holidays) {
    return holidays.some(
      (h) => new Date(h.date).toDateString() === date.toDateString()
    );
  }

  getDayTime(date, timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }

  isWithinWorkingHours(date, config) {
    const start = this.getDayTime(date, config.workingHours.start);
    const end = this.getDayTime(date, config.workingHours.end);
    return date >= start && date < end;
  }

  isBreakTime(date, breaks) {
    return breaks.some((b) => {
      const start = this.getDayTime(date, b.start);
      const end = this.getDayTime(date, b.end);
      return date >= start && date < end;
    });
  }

  moveToNextWorkingStart(date, config) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return this.getDayTime(next, config.workingHours.start);
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

  // ---------------- WORKING TIME ENGINE ----------------

  addWorkingTime(startTime, durationMs, config, holidays) {
    let current = new Date(startTime);

    while (durationMs > 0) {
      // Holiday
      if (this.isHoliday(current, holidays)) {
        current = this.moveToNextWorkingStart(current, config);
        continue;
      }

      // Working hours
      if (!this.isWithinWorkingHours(current, config)) {
        const workStart = this.getDayTime(
          current,
          config.workingHours.start
        );

        if (current < workStart) {
          current = workStart;
        } else {
          current = this.moveToNextWorkingStart(current, config);
        }
        continue;
      }

      // Breaks
      if (this.isBreakTime(current, config.breaks)) {
        current = this.moveToBreakEnd(current, config.breaks);
        continue;
      }

      // Work (1 min chunk)
      current = new Date(current.getTime() + 60000);
      durationMs -= 60000;
    }

    return current;
  }

  // ---------------- MACHINE AVAILABILITY ----------------

  async getMachineConflict(machineId, start, end) {
    return JobStep.findOne({
      machineId,
      startTime: { $lt: end },
      endTime: { $gt: start },
    }).sort({ endTime: 1 });
  }

  async getNextAvailableSlot(
    machineId,
    startTime,
    durationMs,
    config,
    holidays
  ) {
    let currentStart = new Date(startTime);

    while (true) {
      // calculate end with working rules
      const end = this.addWorkingTime(
        currentStart,
        durationMs,
        config,
        holidays
      );

      // check conflict
      const conflict = await this.getMachineConflict(
        machineId,
        currentStart,
        end
      );

      if (!conflict) {
        return { start: currentStart, end };
      }

      // 🔥 jump directly to conflict end (efficient)
      currentStart = new Date(conflict.endTime);
    }
  }

  // ---------------- MAIN FUNCTION ----------------

  async preview(data) {
    const { productId, quantity, startTime, locationId } = data;

    if (!productId || !quantity || !startTime || !locationId) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "Missing required fields",
      };
    }

    const processes = await Process.find({ productId }).sort({ sequence: 1 });

    if (!processes.length) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "No processes found",
      };
    }

    const config = await WorkConfig.findOne({ locationId });

    if (!config) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Work config not found",
      };
    }

    const holidays = await Holiday.find({ locationId });

    // Normalize start → start of working hours
    let currentTime = this.getDayTime(
      new Date(startTime),
      config.workingHours.start
    );

    const originalStart = new Date(currentTime);

    const steps = [];

    for (const process of processes) {
      const durationMs = process.cycleTime * quantity * 1000;

      // 🔥 MACHINE-AWARE SLOT
      const { start, end } = await this.getNextAvailableSlot(
        process.machineId,
        currentTime,
        durationMs,
        config,
        holidays
      );

      steps.push({
        processId: process._id,
        processName: process.name,
        machineId: process.machineId,
        startTime: start,
        endTime: end,
        cycleTime: process.cycleTime,
        manpower: process.manpower,
      });

      currentTime = end;
    }

    const totalDurationMs = currentTime - originalStart;

    return {
      success: true,
      statustype: "OK",
      message: "Planning calculated",
      data: {
        startTime: originalStart,
        totalEndTime: currentTime,
        totalDurationHours: totalDurationMs / (1000 * 60 * 60),
        totalDays: Math.ceil(
          totalDurationMs / (1000 * 60 * 60 * 24)
        ),
        steps,
      },
    };
  }
}

export default new PlanningService();