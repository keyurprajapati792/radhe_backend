import ProductionSlotService from "../services/productionSlot.service.js";

class ProductionSlotController {
  async createSlot(req, res) {
    try {
      const response = await ProductionSlotService.createSlot(req.body);

      return res.status(201).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async getSlots(req, res) {
    try {
      const response = await ProductionSlotService.getSlots(
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

  async startSlot(req, res) {
    try {
      const response = await ProductionSlotService.startSlot(req.params.id);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async completeSlot(req, res) {
    try {
      const response = await ProductionSlotService.completeSlot(req.params.id);

      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new ProductionSlotController();
