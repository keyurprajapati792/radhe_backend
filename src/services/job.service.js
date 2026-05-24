import Job from "../models/job.model.js";
import Process from "../models/process.model.js";
import JobStep from "../models/jobStep.model.js";

class JobService {
  async createJob(payload) {
    const { productId, quantity } = payload;

    const job = await Job.create(payload);

    const processes = await Process.find({
      productId,
    }).sort({ sequence: 1 });

    const steps = processes.map((process) => ({
      jobId: job._id,

      processId: process._id,

      sequence: process.sequence,

      cycleTime: process.cycleTime,

      requiredManpower: process.manpower,

      totalEstimatedTime: process.cycleTime * quantity,

      status: "pending",
    }));

    await JobStep.insertMany(steps);

    return {
      success: true,
      message: "Job created successfully",
      data: job,
    };
  }

  async getJobs(query) {
    const page = Number(query.page) || 1;

    const limit = Number(query.limit) || 10;

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Job.find()
        .populate("clientId")
        .populate("productId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Job.countDocuments(),
    ]);

    return {
      success: true,

      data: jobs,

      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(id) {
    const job = await Job.findById(id)
      .populate("clientId")
      .populate("productId");

    const steps = await JobStep.find({
      jobId: id,
    })
      .populate("processId")
      .sort({ sequence: 1 });

    return {
      success: true,

      data: {
        job,
        steps,
      },
    };
  }
}

export default new JobService();
