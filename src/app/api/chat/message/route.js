import { route, readJson } from "@/lib/route";
import { chatMessageSchema } from "@/lib/validation";
import { checkRateLimit } from "@/middleware/rateLimit";
import { handleUserMessage, serializeConversation } from "@/services/chat.service";
import { AppError } from "@/utils/apiResponse";

export const POST = route(
  async ({ request, shopper }) => {
    // Per ACCOUNT limits (on top of the per-IP limit below) so one user cannot flood the AI or the admins.
    const burst = checkRateLimit(`chat-user-burst:${shopper._id}`, 8, 60_000);
    const hourly = checkRateLimit(`chat-user-hour:${shopper._id}`, 60, 60 * 60_000);
    if (!burst.ok || !hourly.ok) throw new AppError("You are sending messages too fast. Please wait a moment.", 429);

    const { message } = await readJson(request, chatMessageSchema);
    const chat = await handleUserMessage(shopper, message);
    return serializeConversation(chat);
  },
  { customer: true, limit: { name: "chat-send", max: 40, windowMs: 60_000 } }
);
