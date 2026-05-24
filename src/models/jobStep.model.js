import mongoose from "mongoose";

const jobStepSchema = new mongoose.Schema({
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

  assignedMinutes: {
    type: Number,
    default: 0,
  },

  completedMinutes: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["pending", "scheduled", "running", "completed"],
    default: "pending",
  },
});

const JobStep =
  mongoose.models.JobStep || mongoose.model("JobStep", jobStepSchema);

export default JobStep;
