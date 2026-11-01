import ChatConversation from "@/models/ChatConversation";
import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { chatAdminReplySchema, chatAdminUpdateSchema, objectIdSchema } from "@/lib/validation";
import { adminReply, serializeConversation } from "@/services/chat.service";
import { AppError } from "@/utils/apiResponse";

async function load(id) {
  const chat = await ChatConversation.findById(objectIdSchema.parse(id));
  if (!chat) throw new AppError("Chat not found.", 404);
  return chat;
}

export const GET = route(
  async ({ params }) => {
    const chat = await load(params.id);
    if (chat.unreadForAdmin) {
      chat.unreadForAdmin = false;
      await chat.save();
    }
    return serializeConversation(chat, { forAdmin: true });
  },
  { auth: "chats" }
);

// Reply to the customer.
export const POST = route(
  async ({ request, params, user }) => {
    const chat = await load(params.id);
    const { message } = await readJson(request, chatAdminReplySchema);
    const shopper = await User.findById(chat.user);
    await adminReply(chat, message, user, shopper);
    return serializeConversation(chat, { forAdmin: true });
  },
  { auth: "chats", limit: { name: "chat-admin-reply", max: 60, windowMs: 60_000 } }
);

// Resolve the chat, hand it back to the AI, or re-open it for the team.
export const PATCH = route(
  async ({ request, params, user }) => {
    const chat = await load(params.id);
    const { status } = await readJson(request, chatAdminUpdateSchema);
    chat.status = status;
    chat.unreadForAdmin = false;
    if (status === "ai") {
      chat.messages.push({ role: "system", content: "The NS Designer team handed this chat back to the AI stylist." });
      chat.handoverReason = "";
      chat.strikes = 0;
      chat.lockedUntil = null;
    }
    if (status === "handover" && !chat.handoverAt) chat.handoverAt = new Date();
    if (status === "resolved") chat.handledBy = chat.handledBy || user.name;
    chat.lastMessageAt = new Date();
    await chat.save();
    return serializeConversation(chat, { forAdmin: true });
  },
  { auth: "chats" }
);
