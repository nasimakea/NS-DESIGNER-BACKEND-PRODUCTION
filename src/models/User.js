import mongoose from "mongoose";

// A shopper's account (separate from AdminUser so a customer can never reach the admin API).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    phone: { type: String, default: "", index: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    lastChatEmailAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
