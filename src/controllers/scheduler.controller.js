import SchedulerService from "../services/scheduler.service.js";

class SchedulerController {
  async getSuggestions(req, res) {
    try {
      const { jobStepId } = req.params;
      const { locationId } = req.query;

      const response = await SchedulerService.scheduleJob(
        jobStepId,
        Number(locationId),
      );

      return res.status(200).json(response);
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new SchedulerController();
