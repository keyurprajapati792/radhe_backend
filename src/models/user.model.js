import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      required: true,
    },

    locationId: {
      type: Number,
      trim: true,
    },

    firstname: {
      type: String,
      trim: true,
    },

    middlename: {
      type: String,
      trim: true,
    },

    lastname: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
    },

    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "client",
    },
    locationId: {
      type: Number,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

/* Hash password before saving */
userSchema.pre("save", async function () {
  // ✅ Only hash if password is modified
  if (!this.isModified("password")) return;

  // ✅ Skip if password is null/undefined (client case)
  if (!this.password) return;

  this.password = await bcrypt.hash(this.password, 10);
});

/* 🔎 Compare password method */
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model("User", userSchema);
