import mongoose from "mongoose";
import { ADMIN_ROLES } from "@/lib/permissions";

export { ADMIN_ROLES };

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, default: "staff" },
    // Explicit permission keys (see lib/permissions.js). `undefined` on old accounts = use role preset.
    permissions: { type: [String], default: undefined },
    active: { type: Boolean, default: true },
    // Brute-force protection
    failedAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // Bump to invalidate every issued token (password change, "sign out everywhere")
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.AdminUser || mongoose.model("AdminUser", adminUserSchema);
