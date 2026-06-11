import JobStepService from "../services/jobStep.service.js";

class JobStepController {
  async getJobSteps(req, res) {
    try {
      const response = await JobStepService.getJobSteps(req.params.jobId);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async updateJobCard(req, res) {
    try {
      const response = await JobStepService.updateJobCard(req.body);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new JobStepController();
