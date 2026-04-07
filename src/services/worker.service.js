import { Worker } from "../models/worker.model.js";

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
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      Worker.find(filter)
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
}

export default new WorkerService();
