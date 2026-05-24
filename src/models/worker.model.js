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
  skills: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Skill",
    },
  ],
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

const Worker = mongoose.model("Worker", workerSchema);
export default Worker;
