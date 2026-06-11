// controllers/dashboard.controller.js

import DashboardService from "../services/dashboard.service.js";

class DashboardController {
  async getDashboardStats(req, res) {
    try {
      const response = await DashboardService.getDashboardStats(
        req.query.locationId,
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

export default new DashboardController();
