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

    const skip = (page - 1) * limit;

    const filter = {};

    if (locationId) {
      filter.locationId = Number(locationId);
    }

    // Persisted statuses only
    if (status && status !== "occupied") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    let occupiedWorkerIds = [];

    // If requesting occupied workers, first determine who is occupied
    if (status === "occupied") {
      const runningSlots = await ProductionSlot.find({
        status: "running",
      })
        .select("workers")
        .lean();

      occupiedWorkerIds = [
        ...new Set(
          runningSlots.flatMap((slot) =>
            slot.workers.map((worker) => worker.workerId.toString()),
          ),
        ),
      ];

      filter._id = { $in: occupiedWorkerIds };
    }

    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .populate("skills", "name currentHourlyCost")
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Worker.countDocuments(filter),
    ]);

    // Only required when we're NOT already filtering by occupied
    if (status !== "occupied") {
      const workerIds = workers.map((worker) => worker._id);

      const runningSlots = await ProductionSlot.find({
        status: "running",
        "workers.workerId": { $in: workerIds },
      })
        .select("workers")
        .lean();

      occupiedWorkerIds = [
        ...new Set(
          runningSlots.flatMap((slot) =>
            slot.workers.map((worker) => worker.workerId.toString()),
          ),
        ),
      ];
    }

    const occupiedSet = new Set(occupiedWorkerIds);

    const formattedWorkers = workers.map((worker) => {
      const data = worker.toObject();

      if (
        data.status === "available" &&
        occupiedSet.has(worker._id.toString())
      ) {
        data.status = "occupied";
      }

      return data;
    });

    return {
      success: true,
      statustype: "OK",
      data: formattedWorkers,
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

    const workerFilter = {};

    if (locationId) {
      workerFilter.locationId = Number(locationId);
    }

    const workers = await Worker.find(workerFilter);

    const report = await Promise.all(
      workers.map(async (worker) => {
        const slots = await ProductionSlot.find({
          "workers.workerId": worker._id,
          startTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        });

        let totalMinutes = 0;
        let overtimeMinutes = 0;
        let jobsProcessed = new Set();

        slots.forEach((slot) => {
          const duration =
            (new Date(slot.endTime) - new Date(slot.startTime)) / 1000 / 60;
          totalMinutes += duration;
          overtimeMinutes += slot.overtimeMinutes || 0;
          jobsProcessed.add(String(slot.jobId));
        });

        const availableMinutes = await calculateAvailableMinutes(
          startDate,
          endDate,
        );
        const totalHours = +(totalMinutes / 60).toFixed(2);

        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        const totalTime = `${hours}h ${minutes}m`;

        return {
          workerId: worker._id,
          workerName: `${worker.firstName} ${worker.lastName}`,
          overtimeHours: +(overtimeMinutes / 60).toFixed(2),
          jobsProcessed: jobsProcessed.size,
          totalTime: totalTime,
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
