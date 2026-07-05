import Job from "../models/job.model.js";
import Process from "../models/process.model.js";
import JobStep from "../models/jobStep.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import SchedulerService from "./scheduler.service.js";
import mongoose from "mongoose";

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
        .sort({
          priority: 1,
          createdAt: 1,
        })
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
    const jobData = await Job.findById(id)
      .populate("clientId")
      .populate("productId");

    if (!jobData) {
      throw new Error("Job not found");
    }

    const job = {
      ...jobData.toObject(),
      client: jobData.clientId,
      product: jobData.productId,
    };

    delete job.clientId;
    delete job.productId;

    const steps = await JobStep.find({
      jobId: id,
    })
      .populate("processId")
      .sort({ sequence: 1 });

    const slots = await ProductionSlot.find({
      jobId: id,
    })
      .populate({
        path: "machineId",
        select: "name machineNumber status requiredSkills",
      })
      .populate({
        path: "workers.workerId",
        select: "firstName lastName status skills",
      })
      .sort({ plannedStartTime: 1 });

    const affectedSlots = [];

    const formattedSteps = steps.map((step) => {
      const stepSlots = slots
        .filter((slot) => slot.jobStepId.toString() === step._id.toString())
        .map((slot) => {
          const issues = [];

          // Machine Issues
          if (slot.machineId?.status === "maintenance") {
            issues.push({
              type: "machine",
              reason: "maintenance",
            });
          }

          // Worker Issues
          slot.workers.forEach((worker) => {
            if (
              worker.workerId?.status === "leave" ||
              worker.workerId?.status === "terminated"
            ) {
              issues.push({
                type: "worker",
                workerId: worker.workerId?._id,
                workerName: `${worker.workerId?.firstName} ${worker.workerId?.lastName}`,
                reason: worker.workerId?.status,
              });
            }
          });

          const affected = issues.length > 0;

          const formattedSlot = {
            ...slot.toObject(),

            machine: slot.machineId,

            workers: slot.workers.map((worker) => ({
              effort: worker.effort,
              worker: worker.workerId,
            })),

            affected,
            issues,
          };

          delete formattedSlot.machineId;

          if (affected) {
            affectedSlots.push({
              slotId: slot._id,
              stepId: step._id,
              process: step.processId?.name,
              machine: slot.machineId?.name,
              issues,
            });
          }

          return formattedSlot;
        });

      const formattedStep = {
        ...step.toObject(),
        process: step.processId,
        slots: stepSlots,
      };

      delete formattedStep.processId;

      return formattedStep;
    });

    const totalMinutes = steps.reduce(
      (acc, step) => acc + step.totalEstimatedTime,
      0,
    );

    const completedMinutes = steps.reduce(
      (acc, step) => acc + (step.completedMinutes || 0),
      0,
    );

    const progress =
      totalMinutes > 0
        ? Math.round((completedMinutes / totalMinutes) * 100)
        : 0;

    return {
      success: true,
      data: {
        job,
        steps: formattedSteps,

        stats: {
          totalSteps: steps.length,
          totalMinutes,
          completedMinutes,
          progress,
        },

        affected: {
          hasIssues: affectedSlots.length > 0,
          count: affectedSlots.length,
          slots: affectedSlots,
        },
      },
    };
  }

  async updateJobStatus(jobId, status) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const job = await Job.findById(jobId).session(session);

      if (!job) {
        throw new Error("Job not found");
      }

      const allowedStatuses = ["planned", "running", "hold", "completed"];

      if (!allowedStatuses.includes(status)) {
        throw new Error("Invalid job status");
      }

      await Job.findByIdAndUpdate(jobId, { status }, { session });

      await JobStep.updateMany({ jobId }, { status }, { session });

      const slotStatus = status === "planned" ? "pending" : status;

      await ProductionSlot.updateMany(
        { jobId },
        { status: slotStatus },
        { session },
      );

      await session.commitTransaction();

      return {
        success: true,
        message: "Job status updated successfully",
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getJobPlanningData(jobId) {
    const job = await Job.findById(jobId)
      .populate("clientId")
      .populate("productId");

    if (!job) {
      throw new Error("Job not found");
    }

    // Schedule the complete job once
    await SchedulerService.rebuildSchedule(job.locationId);

    // Reload steps after scheduling
    const steps = await JobStep.find({ jobId })
      .populate("processId")
      .sort({ sequence: 1 });

    const enrichedSteps = [];

    for (const step of steps) {
      const slot = await ProductionSlot.findOne({
        jobStepId: step._id,
      })
        .populate("machineId")
        .populate("workers.workerId");

      enrichedSteps.push({
        ...step.toObject(),
        schedule: slot,
      });
    }

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
