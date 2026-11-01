import CustomOrder from "@/models/CustomOrder";
import { route } from "@/lib/route";
import { customOrderSchema } from "@/lib/validation";
import { cleanText } from "@/lib/security";
import { upsertCustomer } from "@/services/customer.service";
import { uploadImageFile } from "@/services/cloudinary.service";
import { pushNotification } from "@/services/notification.service";
import { getSettings } from "@/services/settings.service";
import { generateCustomOrderNumber } from "@/utils/generateOrderId";
import { AppError, ok } from "@/utils/apiResponse";

const MAX_BODY = 6 * 1024 * 1024;
const MAX_DESIGN_IMAGE = 5 * 1024 * 1024;

export const POST = route(
  async ({ request }) => {
    const settings = await getSettings();
    if (settings.maintenanceMode) {
      throw new AppError("Custom orders are temporarily paused. Please try again soon.", 503);
    }

    if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
      throw new AppError("Request is too large.", 413);
    }
    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      throw new AppError("Content-Type must be multipart/form-data.", 415);
    }

    const form = await request.formData();

    // Honeypot: real people never fill this hidden field.
    if (cleanText(form.get("website") || "")) return ok(null, 201);

    const input = customOrderSchema.parse({
      customerName: form.get("customerName") ?? "",
      phone: form.get("phone") ?? "",
      email: form.get("email") ?? "",
      outfitType: form.get("outfitType") ?? "",
      measurements: form.get("measurements") ?? "",
      requirements: form.get("requirements") ?? "",
    });

    let designImage = { publicId: "", url: "" };
    const file = form.get("designImage");
    if (file && typeof file !== "string" && file.size > 0) {
      designImage = await uploadImageFile(file, { folder: "custom-designs", maxBytes: MAX_DESIGN_IMAGE });
    }

    const customer = await upsertCustomer(
      { name: input.customerName, phone: input.phone, email: input.email },
      { customOrdersCount: 1 }
    );

    const order = await CustomOrder.create({
      orderNumber: await generateCustomOrderNumber(),
      customer: customer._id,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      outfitType: input.outfitType,
      measurements: input.measurements,
      requirements: input.requirements,
      designImage,
    });

    pushNotification(
      {
        type: "custom_order",
        title: `New custom order ${order.orderNumber}`,
        body: `${order.customerName} - ${order.outfitType}`,
        link: "/admin/custom-orders",
      },
      { enquiry: false }
    );

    return ok({ orderNumber: order.orderNumber }, 201);
  },
  { limit: { name: "custom-orders", max: 6, windowMs: 10 * 60_000 } }
);
