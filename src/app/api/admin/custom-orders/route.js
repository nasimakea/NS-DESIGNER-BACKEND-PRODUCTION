import CustomOrder from "@/models/CustomOrder";
import { route } from "@/lib/route";
import { listDocs } from "@/lib/crud";
import { serializeCustomOrder } from "@/services/serializers";

export const GET = route(
  (ctx) =>
    listDocs(CustomOrder, ctx.request, {
      searchFields: ["orderNumber", "customerName", "phone", "outfitType"],
      serialize: serializeCustomOrder,
    }),
  { auth: "custom_orders" }
);
