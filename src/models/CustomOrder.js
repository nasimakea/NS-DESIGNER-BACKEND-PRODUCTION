import mongoose from "mongoose";

export const CUSTOM_ORDER_STATUSES = ["New", "Processing", "Completed"];

const customOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true, maxlength: 80 },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    outfitType: { type: String, required: true, maxlength: 120 },
    measurements: { type: String, required: true, maxlength: 1000 },
    requirements: { type: String, default: "", maxlength: 1500 },
    designImage: {
      publicId: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    status: { type: String, enum: CUSTOM_ORDER_STATUSES, default: "New", index: true },
    price: { type: Number, default: null, min: 0 },
    adminNotes: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

customOrderSchema.index({ createdAt: -1 });

export default mongoose.models.CustomOrder || mongoose.model("CustomOrder", customOrderSchema);
