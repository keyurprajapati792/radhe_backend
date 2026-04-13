// services/jobStep.service.js

import JobStep from "../models/jobStep.model.js";

class JobStepService {
  async assignWorkers(jobStepId, data) {
    const { workers } = data;

    if (!workers?.length) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "Workers are required",
      };
    }

    const jobStep = await JobStep.findById(jobStepId);

    if (!jobStep) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "JobStep not found",
      };
    }

    const { startTime, endTime } = jobStep;

    // 🔥 Validate each worker
    for (const w of workers) {
      const { workerId, effort } = w;

      // 1️⃣ Find overlapping jobSteps
      const overlappingSteps = await JobStep.find({
        "workers.workerId": workerId,
        _id: { $ne: jobStepId }, // exclude current
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      });

      // 2️⃣ Calculate used effort
      let usedEffort = 0;

      for (const step of overlappingSteps) {
        const workerEntry = step.workers.find(
          (ws) => ws.workerId.toString() === workerId
        );

        if (workerEntry) {
          usedEffort += workerEntry.effort;
        }
      }

      // 3️⃣ Validate
      if (usedEffort + effort > 100) {
        return {
          success: false,
          statustype: "BAD_REQUEST",
          message: `Worker ${workerId} is overbooked`,
        };
      }
    }

    // ✅ If all valid → assign
    jobStep.workers = workers;

    await jobStep.save();

    return {
      success: true,
      statustype: "OK",
      message: "Workers assigned successfully",
      data: jobStep,
    };
  }
}

export default new JobStepService();