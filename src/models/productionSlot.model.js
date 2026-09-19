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
    segmentIndex: {
      type: Number,
      default: 0,
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

    plannedStartTime: {
      type: Date,
      required: true,
    },

    plannedEndTime: {
      type: Date,
      required: true,
    },

    setupMinutes: {
      type: Number,
      default: 0,
    },

    isOvertime: {
      type: Boolean,
      default: false,
    },

    overtimeMinutes: {
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

    status: {
      type: String,
      enum: ["pending", "running", "hold", "completed"],
      default: "pending",
    },

    needsAttention: {
      type: Boolean,
      default: false,
    },

    shortfall: {
      type: Number,
      default: 0,
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
  },
  { timestamps: true },
);
productionSlotSchema.index({ jobStepId: 1, segmentIndex: 1 }, { unique: true });

const ProductionSlot =
  mongoose.models.ProductionSlot ||
  mongoose.model("ProductionSlot", productionSlotSchema);

export default ProductionSlot;
