import { route, readJson } from "@/lib/route";
import { paymentSchema, objectIdSchema } from "@/lib/validation";
import { addPayment, removePayment, serializeOrder } from "@/services/order.service";
import { AppError } from "@/utils/apiResponse";

// Record money the customer has actually handed over. Only this changes "received" / "remaining".
export const POST = route(
  async ({ request, params, user }) => {
    const input = await readJson(request, paymentSchema);
    const order = await addPayment(objectIdSchema.parse(params.id), input, user);
    return serializeOrder(order);
  },
  { auth: "payments", limit: { name: "payments", max: 60, windowMs: 60_000 } }
);

// Undo a wrongly typed entry: DELETE /api/admin/orders/:id/payments?paymentId=...
export const DELETE = route(
  async ({ request, params }) => {
    const paymentId = new URL(request.url).searchParams.get("paymentId");
    if (!paymentId) throw new AppError("paymentId is required.", 400);
    const order = await removePayment(objectIdSchema.parse(params.id), objectIdSchema.parse(paymentId));
    return serializeOrder(order);
  },
  { auth: "payments" }
);
