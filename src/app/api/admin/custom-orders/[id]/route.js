import CustomOrder from "@/models/CustomOrder";
import { route, readJson } from "@/lib/route";
import { customOrderUpdateSchema, objectIdSchema } from "@/lib/validation";
import { serializeCustomOrder } from "@/services/serializers";
import { SUPER_ONLY } from "@/lib/permissions";
import { AppError } from "@/utils/apiResponse";

export const PATCH = route(
  async ({ request, params }) => {
    const order = await CustomOrder.findById(objectIdSchema.parse(params.id));
    if (!order) throw new AppError("Custom order not found.", 404);
    const input = await readJson(request, customOrderUpdateSchema);

    if (input.status) order.status = input.status;
    if (input.price !== undefined) order.price = input.price;
    if (input.adminNotes !== undefined) order.adminNotes = input.adminNotes;
    await order.save();
    return serializeCustomOrder(order);
  },
  { auth: "custom_orders" }
);

export const DELETE = route(
  async ({ params }) => {
    const deleted = await CustomOrder.findByIdAndDelete(objectIdSchema.parse(params.id));
    if (!deleted) throw new AppError("Custom order not found.", 404);
    return { deleted: true };
  },
  { auth: SUPER_ONLY }
);
