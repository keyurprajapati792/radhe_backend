import mongoose from "mongoose";

const costHistorySchema = new mongoose.Schema(
  {
    hourlyCost: {
      type: Number,
      required: true,
      min: 0,
    },

    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    currentHourlyCost: {
      type: Number,
      required: true,
      min: 0,
    },

    costHistory: {
      type: [costHistorySchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Skill", skillSchema);
