import { route, readJson } from "@/lib/route";
import { orderCreateSchema } from "@/lib/validation";
import { createOrder, serializeOrderReceipt } from "@/services/order.service";
import { runOrderSideEffects } from "@/services/notification.service";
import { getSettings } from "@/services/settings.service";
import { AppError, ok } from "@/utils/apiResponse";

// Placing an order needs a signed-in shopper, so the order is attached to their account
// and its progress shows up under My Account -> Orders.
export const POST = route(
  async ({ request, shopper }) => {
    const settings = await getSettings();
    if (settings.maintenanceMode) {
      throw new AppError("Orders are temporarily paused. Please try again soon.", 503);
    }

    const input = await readJson(request, orderCreateSchema);
    if (!input.customer.email) input.customer.email = shopper.email;

    const order = await createOrder({ ...input, userId: shopper._id });

    // Fire-and-forget: WhatsApp / e-mail must never slow down or fail the order.
    runOrderSideEffects(order._id);

    return ok(serializeOrderReceipt(order), 201);
  },
  { customer: true, limit: { name: "orders", max: 8, windowMs: 10 * 60_000 } }
);
