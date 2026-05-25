import JobStep from "../models/jobStep.model.js";
import ProductionSlot from "../models/productionSlot.model.js";

class ProductionSlotService {
  async createSlot(payload) {
    const slot = await ProductionSlot.create(payload);

    return {
      success: true,
      message: "Slot created successfully",
      data: slot,
    };
  }

  async getSlots(jobStepId) {
    const slots = await ProductionSlot.find({
      jobStepId,
    })
      .populate("machineId")
      .populate("workers.workerId")
      .sort({ startTime: 1 });

    return {
      success: true,
      data: slots,
    };
  }

  async startSlot(id) {
    const slot = await ProductionSlot.findByIdAndUpdate(
      id,
      {
        status: "running",
      },
      {
        new: true,
      },
    );

    await JobStep.findByIdAndUpdate(slot.jobStepId, {
      status: "running",
    });

    return {
      success: true,
      message: "Slot started",
      data: slot,
    };
  }

  async completeSlot(id) {
    const slot = await ProductionSlot.findById(id);

    const updatedSlot = await ProductionSlot.findByIdAndUpdate(
      id,
      {
        status: "completed",
      },
      {
        new: true,
      },
    );

    const jobStep = await JobStep.findById(slot.jobStepId);

    const slotMinutes =
      (new Date(slot.endTime) - new Date(slot.startTime)) / 1000 / 60;

    const completedMinutes = (jobStep.completedMinutes || 0) + slotMinutes;

    const updatePayload = {
      completedMinutes,
    };

    if (completedMinutes >= jobStep.totalEstimatedTime) {
      updatePayload.status = "completed";
    }

    await JobStep.findByIdAndUpdate(jobStep._id, updatePayload);

    return {
      success: true,
      message: "Slot completed",
      data: updatedSlot,
    };
  }
}

export default new ProductionSlotService();
