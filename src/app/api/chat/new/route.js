import { route } from "@/lib/route";
import { startNewConversation, serializeConversation } from "@/services/chat.service";

export const POST = route(
  async ({ shopper }) => serializeConversation(await startNewConversation(shopper)),
  { customer: true, limit: { name: "chat-new", max: 10, windowMs: 10 * 60_000 } }
);
