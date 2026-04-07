import mongoose from "mongoose";

const jobStepSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Process",
  },

  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Machine",
  },

  workers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
    },
  ],

  startTime: Date,
  endTime: Date,

  cycleTime: Number,
  quantity: Number,
  requiredManpower: Number,

  status: {
    type: String,
    enum: ["pending", "scheduled", "running", "completed"],
    default: "pending",
  },
});

const JobStep = mongoose.model("JobStep", jobStepSchema);

export default JobStep;
