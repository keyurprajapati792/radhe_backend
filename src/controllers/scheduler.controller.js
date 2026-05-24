import SchedulerService from "../services/scheduler.service.js";

class SchedulerController {
  async getSuggestions(req, res) {
    try {
      const response = await SchedulerService.getSuggestions(
        req.params.jobStepId,
      );

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new SchedulerController();
