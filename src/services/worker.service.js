import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import { calculateAvailableMinutes, getAffectedJobs } from "../utils/utils.js";

class WorkerService {
  async createWorker(data) {
    const worker = await Worker.create(data);

    return {
      success: true,
      statustype: "CREATED",
      message: "Worker created",
      data: worker,
    };
  }

  async getWorkers(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;

    const search = query.search || "";
    const status = query.status || "";
    const locationId = query.locationId || "";
    const skill = query.skill || "";

    const skip = (page - 1) * limit;

    const filter = {};

    if (locationId) {
      filter.locationId = Number(locationId);
    }

    /*
     * available and occupied are derived statuses.
     *
     * Both start with workers whose stored status is "available".
     * Their actual status is determined by running ProductionSlots.
     */
    if (status === "available" || status === "occupied") {
      filter.status = "available";
    } else if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (skill) {
      filter.skills = skill;
    }

    /*
     * For available / occupied we need to calculate the actual
     * worker status first, so we cannot paginate the Worker query
     * before that calculation.
     */
    if (status === "available" || status === "occupied") {
      const workers = await Worker.find(filter)
        .populate("skills", "name currentHourlyCost")
        .sort({ createdAt: -1 })
        .lean();

      const workerIds = workers.map((worker) => worker._id);

      /*
       * Find all workers currently involved in running slots.
       */
      const runningSlots = await ProductionSlot.find({
        status: "running",
        "workers.workerId": {
          $in: workerIds,
        },
      })
        .select("workers")
        .lean();

      const occupiedWorkerIds = [
        ...new Set(
          runningSlots.flatMap((slot) =>
            (slot.workers || []).map((worker) => worker.workerId.toString()),
          ),
        ),
      ];

      const occupiedSet = new Set(occupiedWorkerIds);

      /*
       * Calculate the actual worker status.
       */
      let formattedWorkers = workers.map((worker) => {
        const isOccupied = occupiedSet.has(worker._id.toString());

        return {
          ...worker,
          status: isOccupied ? "occupied" : "available",
        };
      });

      /*
       * Apply the requested derived status.
       */
      formattedWorkers = formattedWorkers.filter(
        (worker) => worker.status === status,
      );

      const total = formattedWorkers.length;

      /*
       * Paginate AFTER calculating the derived status.
       */
      const paginatedWorkers = formattedWorkers.slice(skip, skip + limit);

      return {
        success: true,
        statustype: "OK",
        data: paginatedWorkers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    /*
     * Normal persisted statuses.
     */
    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .populate("skills", "name currentHourlyCost")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Worker.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: workers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWorkerById(id) {
    const worker = await Worker.findById(id);

    if (!worker) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Worker not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      data: worker,
    };
  }

  async updateWorker(id, data) {
    const worker = await Worker.findByIdAndUpdate(id, data, { new: true });

    return {
      success: true,
      statustype: "OK",
      message: "Worker updated",
      data: worker,
    };
  }

  async updateWorkerStatus(id, status) {
    const worker = await Worker.findById(id);

    if (!worker) {
      throw new Error("Worker not found");
    }

    worker.status = status;
    await worker.save();

    let affectedData;
    if (status === "terminated" || status === "leave") {
      affectedData = await getAffectedJobs({
        "workers.workerId": worker._id,
      });
    }

    return {
      success: true,
      statustype: "OK",
      message: "Worker status updated successfully.",
      data: {
        worker,
        affectedJobs: affectedData?.affectedJobs || [],
        summary: affectedData?.summary || null,
      },
    };
  }

  async deleteWorker(id) {
    await Worker.findByIdAndDelete(id);

    return {
      success: true,
      statustype: "OK",
      message: "Worker deleted",
    };
  }

  async getWorkerUtilizationReport(query = {}) {
    const { locationId, startDate, endDate } = query;

    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime()) ||
      rangeStart >= rangeEnd
    ) {
      throw new Error("Invalid date range");
    }

    const workerFilter = {};

    if (locationId !== undefined && locationId !== null && locationId !== "") {
      workerFilter.locationId = Number(locationId);
    }

    const workers = await Worker.find(workerFilter).lean();

    const report = await Promise.all(
      workers.map(async (worker) => {
        const slots = await ProductionSlot.find({
          "workers.workerId": worker._id,
          plannedStartTime: { $lt: rangeEnd },
          plannedEndTime: { $gt: rangeStart },
        }).lean();

        let totalMinutes = 0;
        let overtimeMinutes = 0;
        const jobsProcessed = new Set();

        for (const slot of slots) {
          const slotStart = new Date(slot.plannedStartTime);
          const slotEnd = new Date(slot.plannedEndTime);

          if (
            Number.isNaN(slotStart.getTime()) ||
            Number.isNaN(slotEnd.getTime()) ||
            slotEnd <= slotStart
          ) {
            continue;
          }

          // Count only the part of the slot inside the selected date range.
          const effectiveStart = Math.max(
            slotStart.getTime(),
            rangeStart.getTime(),
          );

          const effectiveEnd = Math.min(slotEnd.getTime(), rangeEnd.getTime());

          const durationMinutes = (effectiveEnd - effectiveStart) / 60000;

          // Divide by worker effort when multiple workers share a slot.
          const workerAssignment = slot.workers?.find(
            (assignment) => String(assignment.workerId) === String(worker._id),
          );

          const effort = Number(workerAssignment?.effort ?? 100);

          totalMinutes += durationMinutes * (effort / 100);
          overtimeMinutes += Number(slot.overtimeMinutes) || 0;

          if (slot.jobId) {
            jobsProcessed.add(String(slot.jobId));
          }
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);

        return {
          workerId: worker._id,
          workerName:
            `${worker.firstName || ""} ${worker.lastName || ""}`.trim(),
          overtimeHours: +(overtimeMinutes / 60).toFixed(2),
          jobsProcessed: jobsProcessed.size,
          totalTime: `${hours}h ${minutes}m`,
        };
      }),
    );

    return {
      success: true,
      statustype: "OK",
      data: report,
    };
  }
}

export default new WorkerService();
