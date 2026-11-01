import Order from "@/models/Order";
import { route } from "@/lib/route";
import { objectIdSchema } from "@/lib/validation";
import { buildOrderPdf } from "@/services/pdf.service";
import { AppError } from "@/utils/apiResponse";

export const GET = route(
  async ({ params }) => {
    const order = await Order.findById(objectIdSchema.parse(params.id));
    if (!order) throw new AppError("Order not found.", 404);
    const pdf = await buildOrderPdf(order);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${order.orderNumber}_Order_Details.pdf"`,
      },
    });
  },
  { auth: "orders" }
);
