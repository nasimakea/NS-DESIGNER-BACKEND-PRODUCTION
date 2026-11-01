import { route } from "@/lib/route";
import { getOrCreateConversation, serializeConversation } from "@/services/chat.service";

// The shopper's current conversation. The page polls this while a human has the chat.
export const GET = route(
  async ({ shopper }) => {
    const chat = await getOrCreateConversation(shopper);
    if (chat.unreadForUser) {
      chat.unreadForUser = false;
      await chat.save();
    }
    return serializeConversation(chat);
  },
  { customer: true, limit: { name: "chat-read", max: 90, windowMs: 60_000 } }
);
