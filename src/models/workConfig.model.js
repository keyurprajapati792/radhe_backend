import mongoose from "mongoose";

const breakSchema = new mongoose.Schema({
  start: {
    type: String, 
    required: true,
  },
  end: {
    type: String, 
    required: true,
  },
});

const workConfigSchema = new mongoose.Schema({
  locationId: {
    type: Number,
    required: true,
  },

  workingHours: {
    start: {
      type: String, 
      required: true,
    },
    end: {
      type: String, 
      required: true,
    },
  },

  breaks: [breakSchema],

  overtime: {
    enabled: {
      type: Boolean,
      default: false,
    },
    end: {
      type: String, 
    },
  },
});

const WorkConfig = mongoose.model("WorkConfig", workConfigSchema);

export default WorkConfig;