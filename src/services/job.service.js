import Job from "../models/job.model.js";
import Process from "../models/process.model.js";
import JobStep from "../models/jobStep.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import SchedulerService from "./scheduler.service.js";

class JobService {
  async createJob(payload) {
    const { productId, quantity, locationId } = payload;

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

    const formattedJobs = jobs.map((job) => {
      const data = job.toObject();
      data.client = data.clientId;
      data.product = data.productId;
      delete data.clientId;
      delete data.productId;
      return data;
    });
    return {
      success: true,
      data: formattedJobs,
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

    const formattedJob = job.toObject();
    formattedJob.client = formattedJob.clientId;
    formattedJob.product = formattedJob.productId;
    delete formattedJob.clientId;
    delete formattedJob.productId;
    formattedJob.steps = steps;
    return {
      success: true,
      data: formattedJob,
    };
  }

  async getJobPlanningData(jobId) {
    const job = await Job.findById(jobId)
      .populate("clientId")
      .populate("productId");

    const steps = await JobStep.find({ jobId }).sort({ sequence: 1 });

    const enrichedSteps = await Promise.all(
      steps.map(async (step) => {
        const suggestions = await SchedulerService.getSuggestions(
          step._id,
          job.locationId,
        );

        return {
          ...step.toObject(),
          suggestions,
        };
      }),
    );

    const formattedJob = {
      ...job.toObject(),
      client: job.clientId,
      product: job.productId,
    };

    delete formattedJob.clientId;
    delete formattedJob.productId;

    return {
      success: true,
      data: {
        job: formattedJob,
        steps: enrichedSteps,
      },
    };
  }
}

export default new JobService();
