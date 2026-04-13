import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: Number,
  status: {
    type: String,
    enum: ["planned", "in_progress", "completed"],
    default: "planned",
  },
});


const Job = mongoose.model("JOb", jobSchema);

export default Job;