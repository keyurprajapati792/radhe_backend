import JobStep from "../models/jobStep.model.js";
import Job from "../models/job.model.js";

class JobStepService {
  async getJobSteps(jobId) {
    const steps = await JobStep.find({
      jobId,
    })
      .populate("processId")
      .sort({ sequence: 1 });

    return {
      success: true,
      data: steps,
    };
  }

  async updateJobCard(data) {
    const { steps } = data;

    for (const step of steps) {
      await JobStep.findByIdAndUpdate(step.jobStepId, {
        producedQty: step.producedQty,
        rejectQty: step.rejectQty,
        reworkQty: step.reworkQty,
        approvedQty: step.approvedQty,
        setupMinutes: step.setupMinutes,
        actualStartTime: step.actualStartTime,
        actualEndTime: step.actualEndTime,
        remarks: step.remarks,
        status: step.status,
      });
    }

    // update job status automatically
    const firstStep = await JobStep.findById(steps[0].jobStepId);

    const allSteps = await JobStep.find({
      jobId: firstStep.jobId,
    });

    const allCompleted = allSteps.every((step) => step.status === "completed");

    if (allCompleted) {
      await Job.findByIdAndUpdate(firstStep.jobId, {
        status: "completed",
      });
    }

    return {
      success: true,
      message: "Job card updated successfully",
    };
  }
}

export default new JobStepService();
