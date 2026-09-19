import mongoose from "mongoose";

const processSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  name: {
    type: String,
    required: true,
  },

  requiredMachineType: {
    type: String,
    required: true,
  },

  // NEW
  machineIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
    },
  ],

  cycleTime: {
    type: Number,
    required: true,
  },

  manpower: {
    type: Number,
    required: true,
  },

  manpowerRequirements: [
    {
      skillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Skill",
        required: true,
      },
      count: {
        type: Number,
        required: true,
        min: 1,
      },
      effort: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
        default: 100,
      },
    },
  ],

  sequence: {
    type: Number,
    required: true,
  },

  locationId: {
    type: Number,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

const Process = mongoose.model("Process", processSchema);

export default Process;
