import mongoose from "mongoose";

export const AUDIENCES = ["Men", "Women", "Both"];

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    audience: { type: String, enum: AUDIENCES, default: "Both" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Category || mongoose.model("Category", categorySchema);
