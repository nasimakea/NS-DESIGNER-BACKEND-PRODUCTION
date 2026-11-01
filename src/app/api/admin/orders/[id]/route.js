import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { route, readJson } from "@/lib/route";
import { orderUpdateSchema, objectIdSchema } from "@/lib/validation";
import { serializeOrder, applyOrderUpdate } from "@/services/order.service";
import { SUPER_ONLY } from "@/lib/permissions";
import { AppError } from "@/utils/apiResponse";

async function load(id) {
  const order = await Order.findById(objectIdSchema.parse(id));
  if (!order) throw new AppError("Order not found.", 404);
  return order;
}

export const GET = route(
  async ({ params }) => serializeOrder(await load(params.id)),
  { auth: { anyOf: ["orders", "customers", "dashboard"] } }
);

// Used by BOTH the dashboard "Action" menu and the Orders page - one code path, one database record.
export const PATCH = route(
  async ({ request, params, user }) => {
    const order = await load(params.id);
    const input = await readJson(request, orderUpdateSchema);
    await applyOrderUpdate(order, input, user);
    return serializeOrder(order);
  },
  { auth: "orders" }
);

// Hard delete is reserved for Super Admins (e.g. removing spam). Prefer "Cancelled".
export const DELETE = route(
  async ({ params }) => {
    const order = await load(params.id);
    const inc = { totalSpent: -(order.amountReceived || 0) };
    if (order.status !== "Cancelled") inc.ordersCount = -1;
    await Customer.updateOne({ _id: order.customer }, { $inc: inc });
    await order.deleteOne();
    return { deleted: true };
  },
  { auth: SUPER_ONLY }
);
