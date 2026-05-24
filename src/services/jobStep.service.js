import JobStep from "../models/jobStep.model.js";

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
}

export default new JobStepService();
