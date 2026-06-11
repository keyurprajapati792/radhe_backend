import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import { calculateAvailableMinutes } from "../utils/utils.js";

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

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      Worker.find(filter)
        .populate("skills", "name currentHourlyCost")
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Worker.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: users,
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
