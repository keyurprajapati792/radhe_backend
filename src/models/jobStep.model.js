import mongoose from "mongoose";

const jobStepSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    processId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Process",
      required: true,
    },

    sequence: {
      type: Number,
      required: true,
    },

    cycleTime: {
      type: Number,
      required: true,
    },

    requiredManpower: {
      type: Number,
      required: true,
    },

    totalEstimatedTime: {
      type: Number,
      required: true,
    },

    plannedStartTime: {
      type: Date,
    },

    plannedEndTime: {
      type: Date,
    },

    assignedMinutes: {
      type: Number,
      default: 0,
    },

    completedMinutes: {
      type: Number,
      default: 0,
    },

    setupMinutes: {
      type: Number,
      default: 0,
    },

    actualStartTime: {
      type: Date,
      default: null,
    },

    actualEndTime: {
      type: Date,
      default: null,
    },

    producedQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    reworkQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    approvedQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "scheduled", "running", "completed", "hold"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

const JobStep =
  mongoose.models.JobStep || mongoose.model("JobStep", jobStepSchema);

export default JobStep;
