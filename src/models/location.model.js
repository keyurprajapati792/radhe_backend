import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    locationId: {
      type: Number,
      unique: true,
    },
  },
  { timestamps: true },
);

locationSchema.pre("save", function () {
  if (!this.locationId) {
    this.locationId = Math.floor(100000 + Math.random() * 900000);
  }
});

export const Location = mongoose.model("Location", locationSchema);
