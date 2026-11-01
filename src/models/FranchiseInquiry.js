import mongoose from "mongoose";

export const FRANCHISE_STATUSES = ["New", "Contacted", "Converted"];

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    city: { type: String, required: true, maxlength: 100 },
    investment: { type: String, default: "", maxlength: 40 },
    message: { type: String, default: "", maxlength: 1500 },
    status: { type: String, enum: FRANCHISE_STATUSES, default: "New", index: true },
    adminNotes: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });

export default mongoose.models.FranchiseInquiry || mongoose.model("FranchiseInquiry", schema);
