import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: Number,
  orderDate: {
    type: Date,
    required: true,
  },
  // startDate: {
  //   type: Date,
  //   // required: true,
  // },
  priority: {
    type: Number,
    default: 3,
    min: 1,
    max: 5,
  },
  status: {
    type: String,
    enum: ["planned", "in_progress", "completed"],
    default: "planned",
  },
  locationId: {
    type: Number,
    required: true,
  },
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
