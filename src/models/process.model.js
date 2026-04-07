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
  machineType: {
    type: String,
    required: true,
  },

  cycleTime: {
    type: Number,
    required: true,
  },
  manpower: {
    type: Number,
    required: true,
  },
  sequence: {
    type: Number,
    required: true,
  },
  locationId: {
    type: Number,
    trim: true,
  },
});

const Process = mongoose.model("Process", processSchema);

export default Process;
