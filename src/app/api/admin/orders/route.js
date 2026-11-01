import Order from "@/models/Order";
import { route } from "@/lib/route";
import { listDocs } from "@/lib/crud";
import { serializeOrder } from "@/services/order.service";

export const GET = route(
  (ctx) =>
    listDocs(Order, ctx.request, {
      searchFields: ["orderNumber", "customerName", "phone", "items.name"],
      serialize: serializeOrder,
    }),
  { auth: { anyOf: ["orders", "customers", "dashboard"] } }
);
