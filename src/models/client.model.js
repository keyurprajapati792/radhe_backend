import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      trim: true,
      unique: true,
      required: true,
    },

    customerName: {
      type: String,
      trim: true,
    },

    legalName: {
      type: String,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    contactNumber: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      set: (value) => {
        if (!value) return undefined;
        return value;
      },
    },

    address: {
      type: String,
      trim: true,
    },

    pincode: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
      default: "India",
    },

    gstNumber: {
      type: String,
      trim: true,
    },

    clientType: {
      type: String,
      enum: ["BUSINESS", "INDIVIDUAL"],
      default: "BUSINESS",
    },

    locationId: {
      type: Number,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Client = mongoose.model("Client", clientSchema);
