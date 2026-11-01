import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["order", "custom_order", "franchise", "message", "chat", "system"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, default: "", maxlength: 400 },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

schema.index({ createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", schema);
