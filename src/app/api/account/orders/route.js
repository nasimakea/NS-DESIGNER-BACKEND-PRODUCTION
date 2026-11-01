import Order from "@/models/Order";
import { route } from "@/lib/route";
import { serializeOrderForCustomer } from "@/services/order.service";

// The signed-in shopper's own orders - status and payment status come from the same
// database record the admin edits, so any admin change shows up here.
export const GET = route(
  async ({ shopper }) => {
    const orders = await Order.find({ user: shopper._id }).sort({ createdAt: -1 }).limit(100);
    return { items: orders.map(serializeOrderForCustomer) };
  },
  { customer: true, limit: { name: "my-orders", max: 120, windowMs: 60_000 } }
);
