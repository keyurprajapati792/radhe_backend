// services/job.service.js

import Job from "../models/job.model.js";
import JobStep from "../models/jobStep.model.js";
import Process from "../models/process.model.js";

class JobService {
  async create(data) {
    const { clientId, productId, quantity, steps } = data;

    if (!clientId || !productId || !quantity || !steps?.length) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "Missing required fields",
      };
    }

    // 1️⃣ Create Job
    const job = await Job.create({
      clientId,
      productId,
      quantity,
    });

    // 2️⃣ Create JobSteps
    const jobSteps = [];

    for (const step of steps) {
      const process = await Process.findById(step.processId);

      jobSteps.push({
        jobId: job._id,
        processId: step.processId,
        startTime: step.startTime,
        endTime: step.endTime,
        cycleTime: process.cycleTime,
        quantity,
        requiredManpower: process.manpower,
        workers: [], // assigned later
        machineId: null,
      });
    }

    await JobStep.insertMany(jobSteps);

    return {
      success: true,
      statustype: "OK",
      message: "Job created successfully",
      data: {
        jobId: job._id,
      },
    };
  }
}

export default new JobService();