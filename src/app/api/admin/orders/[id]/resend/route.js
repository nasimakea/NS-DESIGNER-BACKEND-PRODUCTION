import Order from "@/models/Order";
import { route } from "@/lib/route";
import { objectIdSchema } from "@/lib/validation";
import { runOrderSideEffects } from "@/services/notification.service";
import { serializeOrder } from "@/services/order.service";
import { AppError } from "@/utils/apiResponse";

// Retry the WhatsApp / e-mail alert for an order whose notification failed.
export const POST = route(
  async ({ params }) => {
    const id = objectIdSchema.parse(params.id);
    if (!(await Order.exists({ _id: id }))) throw new AppError("Order not found.", 404);
    await runOrderSideEffects(id, { inApp: false });
    return serializeOrder(await Order.findById(id));
  },
  { auth: "orders", limit: { name: "resend", max: 20, windowMs: 60_000 } }
);
