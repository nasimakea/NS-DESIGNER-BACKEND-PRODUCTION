import ChatConversation from "@/models/ChatConversation";
import { route } from "@/lib/route";

// Inbox of chats: those waiting for a human first, newest activity on top.
export const GET = route(
  async ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") || "handover";
    const filter = status === "all" ? {} : { status };
    const chats = await ChatConversation.find(filter).sort({ unreadForAdmin: -1, lastMessageAt: -1 }).limit(200).lean();
    const counts = await ChatConversation.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    return {
      items: chats.map((c) => {
        const last = c.messages[c.messages.length - 1];
        return {
          id: String(c._id), userName: c.userName, userEmail: c.userEmail, status: c.status,
          handoverReason: c.handoverReason, unreadForAdmin: c.unreadForAdmin, strikes: c.strikes,
          lastMessageAt: c.lastMessageAt, preview: last ? last.content.slice(0, 120) : "", handledBy: c.handledBy,
        };
      }),
      counts: Object.fromEntries(counts.map((r) => [r._id, r.count])),
    };
  },
  { auth: "chats" }
);
