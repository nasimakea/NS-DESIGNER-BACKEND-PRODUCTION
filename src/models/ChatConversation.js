import mongoose from "mongoose";

export const CHAT_STATUSES = ["ai", "handover", "resolved"];
export const HANDOVER_REASONS = ["out_of_domain", "customer_requested", "needs_staff", "ai_unavailable"];

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant", "admin", "system"], required: true },
  content: { type: String, required: true, maxlength: 2000 },
  // Only product slugs are stored; names, prices and images are always re-read from the catalogue.
  productSlugs: { type: [String], default: [] },
  suggestions: { type: [String], default: [] },
  adminName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    status: { type: String, enum: CHAT_STATUSES, default: "ai", index: true },
    handoverReason: { type: String, enum: [...HANDOVER_REASONS, ""], default: "" },
    handoverAt: { type: Date, default: null },
    handledBy: { type: String, default: "" },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadForAdmin: { type: Boolean, default: false },
    unreadForUser: { type: Boolean, default: false },
    // Security: how many times this chat tried prompt-injection / abuse, and a temporary lock.
    strikes: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

chatSchema.index({ status: 1, lastMessageAt: -1 });

export default mongoose.models.ChatConversation || mongoose.model("ChatConversation", chatSchema);
