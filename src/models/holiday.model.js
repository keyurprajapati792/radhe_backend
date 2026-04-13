import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  date: {
    type: Date,
    required: true,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
});

const Holiday = mongoose.model("Holiday", holidaySchema);

export default Holiday;