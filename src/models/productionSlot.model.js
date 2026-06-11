import mongoose from "mongoose";

const productionSlotSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

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

        effort: {
          type: Number,
          default: 100,
        },
      },
    ],

    // Planned Schedule
    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    // Actual Machine Usage
    actualStartTime: {
      type: Date,
      default: null,
    },

    actualEndTime: {
      type: Date,
      default: null,
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
      enum: ["pending", "running", "completed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

const ProductionSlot = mongoose.model("ProductionSlot", productionSlotSchema);

export default ProductionSlot;
