import Notification from "@/models/Notification";
import { route } from "@/lib/route";

const shape = (n) => ({
  id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt,
});

export const GET = route(
  async () => {
    const [items, unread] = await Promise.all([
      Notification.find().sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ read: false }),
    ]);
    return { items: items.map(shape), unread };
  },
  { auth: true }
);

// Mark everything as read.
export const PATCH = route(
  async () => {
    await Notification.updateMany({ read: false }, { $set: { read: true } });
    return { unread: 0 };
  },
  { auth: true }
);
