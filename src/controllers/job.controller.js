import JobService from "../services/job.service.js";

class JobController {
  async createJob(req, res) {
    try {
      const response = await JobService.createJob(req.body);

      return res.status(201).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async getJobs(req, res) {
    try {
      const response = await JobService.getJobs(req.query);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async getJobById(req, res) {
    try {
      const response = await JobService.getJobById(req.params.id);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
  async getJobPlanningData(req, res) {
    try {
      const response = await JobService.getJobPlanningData(req.params.id);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new JobController();
