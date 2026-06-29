// services/dashboard.service.js

import { User } from "../models/user.model.js";
import Job from "../models/job.model.js";
import { Client } from "../models/client.model.js";
import Worker from "../models/worker.model.js";

class DashboardService {
  async getDashboardStats(locationId) {
    if (!locationId) {
      throw new Error("Location ID is required");
    }

    // CLIENTS
    const clients = await Client.countDocuments({
      locationId,
    });

    // WORKERS
    const workers = await Worker.countDocuments({
      locationId,
    });

    // JOBS
    const totalJobs = await Job.countDocuments({
      locationId,
    });

    const plannedJobs = await Job.countDocuments({
      locationId,
      status: "planned",
    });

    const inProgressJobs = await Job.countDocuments({
      locationId,
      status: "in_progress",
    });

    const completedJobs = await Job.countDocuments({
      locationId,
      status: "completed",
    });

    // RECENT JOBS
    const recentJobs = await Job.find({
      locationId,
    })
      .populate("clientId")
      .populate("productId")
      .sort({ createdAt: -1 })
      .limit(10);

    const formattedJobs = recentJobs.map((job) => ({
      ...job.toObject(),
      client: job.clientId,
      product: job.productId,
    }));

    formattedJobs.forEach((job) => {
      delete job.clientId;
      delete job.productId;
    });

    return {
      success: true,

      data: {
        stats: {
          clients,
          workers,
          totalJobs,
          plannedJobs,
          inProgressJobs,
          completedJobs,
        },

        jobs: formattedJobs,
      },
    };
  }
}

export default new DashboardService();
