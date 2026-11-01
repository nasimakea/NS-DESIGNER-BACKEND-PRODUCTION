import mongoose from "mongoose";

export const MESSAGE_STATUSES = ["New", "Replied", "Closed"];
export const MESSAGE_CATEGORIES = [
  "Product Enquiry",
  "Order Enquiry",
  "Custom Stitching",
  "Franchise Enquiry",
  "Other",
];

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    subject: { type: String, default: "", maxlength: 150 },
    category: { type: String, enum: MESSAGE_CATEGORIES, default: "Other" },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: MESSAGE_STATUSES, default: "New", index: true },
    adminNotes: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });

export default mongoose.models.ContactMessage || mongoose.model("ContactMessage", schema);
