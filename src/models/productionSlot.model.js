import mongoose from "mongoose";

const productionSlotSchema = new mongoose.Schema({
  jobStepId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobStep",
    required: true,
  },

  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Machine",
    required: true,
  },

  workers: [
    {
      workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
      },

      effort: Number,
    },
  ],

  startTime: {
    type: Date,
    required: true,
  },

  endTime: {
    type: Date,
    required: true,
  },

  isOvertime: {
    type: Boolean,
    default: false,
  },

  overtimeMinutes: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["scheduled", "running", "completed"],
    default: "scheduled",
  },
});

const ProductionSlot = mongoose.model("ProductionSlot", productionSlotSchema);

export default ProductionSlot;
