import mongoose from "mongoose";

const workerSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  middleName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["available", "leave", "terminated"],
    default: "available",
  },
  phone: {
    type: String,
    trim: true,
  },
  locationId: {
    type: Number,
    required: true,
  },
});

export const Worker = mongoose.model("Worker", workerSchema);
