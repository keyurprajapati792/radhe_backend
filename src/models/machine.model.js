import mongoose from "mongoose";

const machineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  machineNumber: {
    type: String,
    required: true,
  },
  locationId: {
    type: Number,
    trim: true,
  },
  status: {
    type: String,
    enum: ["available", "occupied", "maintenance"],
    default: "available",
  },
});

const Machine = mongoose.model("Machine", machineSchema);

export default Machine;
