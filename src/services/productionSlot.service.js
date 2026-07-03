import JobStep from "../models/jobStep.model.js";
import Machine from "../models/machine.model.js";
import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";

class ProductionSlotService {
  async createSlots(payload) {
    const { slots } = payload;

    const createdSlots = [];

    for (const slotPayload of slots) {
      // remove old slot if replanning
      await ProductionSlot.deleteMany({
        jobStepId: slotPayload.jobStepId,
      });

      const slot = await ProductionSlot.create(slotPayload);

      const slotMinutes =
        (new Date(slot.endTime) - new Date(slot.startTime)) / 1000 / 60;

      await JobStep.findByIdAndUpdate(slot.jobStepId, {
        assignedMinutes: slotMinutes,
      });

      createdSlots.push(slot);
    }

    return {
      success: true,
      message: "Planning saved successfully",
      data: createdSlots,
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

  async updateSlots(payload) {
    const { slots } = payload;

    const updated = [];

    console.log(slots);

    for (const data of slots) {
      const existingSlot = await ProductionSlot.findById(data.slotId);

      if (!existingSlot) {
        throw new Error("Production slot not found");
      }

      // ----------------------------------------------------
      // Check whether machine/workers have changed
      // ----------------------------------------------------

      const machineChanged =
        data.machineId &&
        data.machineId?.toString() !== existingSlot?.machineId?.toString();

      const existingWorkers = (existingSlot.workers || [])
        .map((w) => ({
          workerId: w.workerId.toString(),
          effort: w.effort,
        }))
        .sort((a, b) => a.workerId.localeCompare(b.workerId));

      const newWorkers = (data.workers || [])
        .map((w) => ({
          workerId: w.workerId.toString(),
          effort: w.effort,
        }))
        .sort((a, b) => a.workerId.localeCompare(b.workerId));

      const workersChanged =
        JSON.stringify(existingWorkers) !== JSON.stringify(newWorkers);

      // ====================================================
      // RUNNING SLOT + RESOURCE CHANGED
      // Create continuation slot
      // ====================================================

      if (
        existingSlot.status === "running" &&
        (machineChanged || workersChanged)
      ) {
        // Close current slot
        existingSlot.actualEndTime = new Date();
        existingSlot.status = "completed";

        await existingSlot.save();

        // Create continuation slot
        const newSlot = await ProductionSlot.create({
          jobId: existingSlot.jobId,
          jobStepId: existingSlot.jobStepId,

          machineId: machineChanged ? data.machineId : existingSlot.machineId,

          workers: workersChanged ? data.workers : existingSlot.workers,

          plannedStartTime: new Date(),

          plannedEndTime: existingSlot.plannedEndTime,

          setupMinutes: data.setupMinutes ?? 0,

          isOvertime: existingSlot.isOvertime,
          overtimeMinutes: existingSlot.overtimeMinutes,

          actualStartTime: null,
          actualEndTime: null,

          status: "pending",

          producedQty: existingSlot.producedQty,
          rejectQty: existingSlot.rejectQty,
          reworkQty: existingSlot.reworkQty,
          approvedQty: existingSlot.approvedQty,
        });

        updated.push(newSlot);

        continue;
      }

      // ====================================================
      // NORMAL UPDATE
      // ====================================================

      const slot = await ProductionSlot.findByIdAndUpdate(
        data.slotId,
        {
          status: data.status,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,

          setupMinutes: data.setupMinutes,

          producedQty: data.producedQty,
          rejectQty: data.rejectQty,
          reworkQty: data.reworkQty,
          approvedQty: data.approvedQty,

          ...(data.machineId && {
            machineId: data.machineId,
          }),

          ...(data.workers && {
            workers: data.workers,
          }),
        },
        {
          new: true,
        },
      );

      updated.push(slot);
    }

    return {
      success: true,
      message: "Production slots updated successfully",
      data: updated,
    };
  }

  async getReplacementMachines(slotId) {
    const slot = await ProductionSlot.findById(slotId).populate(
      "machineId",
      "requiredSkills",
    );

    if (!slot) {
      throw new Error("Production slot not found");
    }

    const requiredSkills = slot.machineId?.requiredSkills || [];

    // Machines already assigned in this job
    const jobSlots = await ProductionSlot.find({
      jobId: slot.jobId,
    }).select("machineId");

    const jobMachineIds = [
      ...new Set(
        jobSlots.filter((s) => s.machineId).map((s) => s.machineId.toString()),
      ),
    ];

    // Machines occupied in other running jobs
    const occupiedSlots = await ProductionSlot.find({
      status: "running",
      jobId: { $ne: slot.jobId },
    }).select("machineId");

    const occupiedMachineIds = [
      ...new Set(
        occupiedSlots
          .filter((s) => s.machineId)
          .map((s) => s.machineId.toString()),
      ),
    ];

    const excludedIds = [...new Set([...jobMachineIds, ...occupiedMachineIds])];

    const machines = await Machine.find({
      status: "available",
      _id: { $nin: excludedIds },
      requiredSkills: {
        $all: requiredSkills,
      },
    }).sort({
      machineNumber: 1,
    });

    return {
      success: true,
      data: machines,
    };
  }

  async getReplacementWorkers(slotId) {
    const slot = await ProductionSlot.findById(slotId).populate(
      "machineId",
      "requiredSkills",
    );

    if (!slot) {
      throw new Error("Production slot not found");
    }

    const requiredSkills = slot.machineId?.requiredSkills || [];

    // Workers already assigned in this job
    const jobSlots = await ProductionSlot.find({
      jobId: slot.jobId,
    }).select("workers");

    const jobWorkerIds = [
      ...new Set(
        jobSlots.flatMap((s) => s.workers.map((w) => w.workerId.toString())),
      ),
    ];

    // Workers occupied in other running jobs
    const occupiedSlots = await ProductionSlot.find({
      status: "running",
      jobId: { $ne: slot.jobId },
    }).select("workers");

    const occupiedWorkerIds = [
      ...new Set(
        occupiedSlots.flatMap((s) =>
          s.workers.map((w) => w.workerId.toString()),
        ),
      ),
    ];

    const excludedIds = [...new Set([...jobWorkerIds, ...occupiedWorkerIds])];

    const workers = await Worker.find({
      status: "available",
      _id: { $nin: excludedIds },
      skills: {
        $all: requiredSkills,
      },
    })
      .populate("skills")
      .sort({
        firstName: 1,
      });

    return {
      success: true,
      data: workers,
    };
  }
}

export default new ProductionSlotService();
