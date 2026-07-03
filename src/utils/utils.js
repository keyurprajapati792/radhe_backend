import ProductionSlot from "../models/productionSlot.model.js";

export const calculateAvailableMinutes = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const diffMinutes = (end - start) / 1000 / 60;

  return diffMinutes;
};

export const getAffectedJobs = async (filter) => {
  const slots = await ProductionSlot.find({
    ...filter,
    status: {
      $in: ["pending", "running"],
    },
  })
    .populate({
      path: "jobId",
      select: "jobNumber status",
    })
    .populate({
      path: "jobStepId",
      select: "sequence processId",
      populate: {
        path: "processId",
        select: "name",
      },
    });

  const affectedJobs = slots.map((slot) => ({
    jobId: slot.jobId?._id || null,
    jobStatus: slot.jobId?.status || null,
    slotId: slot._id,
    jobStepId: slot.jobStepId?._id || null,
    sequence: slot.jobStepId?.sequence || null,
    processName: slot.jobStepId?.processId?.name || null,
    slotStatus: slot.status,
  }));

  // 🔥 SUMMARY LOGIC
  const summary = {
    affectedJobs: affectedJobs.length,
    runningJobs: slots.filter((s) => s.status === "running").length,
    pendingJobs: slots.filter((s) => s.status === "pending").length,
  };

  return {
    affectedJobs,
    summary,
  };
};
