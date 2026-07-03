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

    status: {
      type: String,
      enum: ["planned", "pending", "running", "hold", "completed"],
      default: "planned",
    },
  },
  { timestamps: true },
);

const JobStep = mongoose.model("JobStep", jobStepSchema);

export default JobStep;
