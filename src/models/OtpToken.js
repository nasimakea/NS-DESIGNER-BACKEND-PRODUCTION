import mongoose from "mongoose";

export const OTP_PURPOSES = ["verify", "reset"];

// One live code per (email, purpose). Only a keyed hash of the code is stored.
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  purpose: { type: String, enum: OTP_PURPOSES, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Mongo deletes expired codes

export default mongoose.models.OtpToken || mongoose.model("OtpToken", otpSchema);
