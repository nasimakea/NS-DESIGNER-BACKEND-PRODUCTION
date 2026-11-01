import Notification from "@/models/Notification";
import Order from "@/models/Order";
import { getSettings } from "./settings.service";
import { buildOrderPdf } from "./pdf.service";
import { notifyAdminOfOrder } from "./whatsapp.service";
import { sendOrderConfirmationEmail } from "./email.service";

/** Creates the in-app (bell) notification. Never throws. */
export async function pushNotification({ type, title, body = "", link = "" }, { enquiry = false } = {}) {
  try {
    const settings = await getSettings();
    const allowed = enquiry ? settings.enquiryNotifications : settings.orderNotifications;
    if (!allowed) return null;
    return await Notification.create({ type, title, body, link });
  } catch (error) {
    console.error("[notification] failed:", error?.message);
    return null;
  }
}

/**
 * Runs after an order is saved: in-app alert, WhatsApp (+PDF) to the admin,
 * and an optional confirmation e-mail. Failures are recorded on the order so
 * they can be retried from the admin panel; they never affect the customer.
 */
export async function runOrderSideEffects(orderId, { inApp = true } = {}) {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    if (inApp) {
      await pushNotification({
        type: "order",
        title: `New order ${order.orderNumber}`,
        body: `${order.customerName} - Rs. ${Number(order.total).toLocaleString("en-IN")}`,
        link: "/admin/orders",
      });
    }

    const settings = await getSettings();
    order.notification.attempts += 1;

    if (!settings.orderNotifications) {
      order.notification.status = "Skipped";
    } else {
      let pdf = null;
      try {
        pdf = await buildOrderPdf(order);
      } catch (error) {
        console.error("[pdf] failed:", error?.message);
      }
      const result = await notifyAdminOfOrder(order, pdf);
      if (result.sent) {
        order.notification.status = "Sent";
        order.notification.sentAt = new Date();
        order.notification.lastError = "";
      } else if (result.skipped) {
        order.notification.status = "Skipped";
        order.notification.lastError = result.error || "";
      } else {
        order.notification.status = "Failed";
        order.notification.lastError = result.error || "Unknown error";
      }
    }
    await order.save();

    try {
      await sendOrderConfirmationEmail(order);
    } catch (error) {
      console.error("[email] failed:", error?.message);
    }
  } catch (error) {
    console.error("[order side effects] failed:", error?.message);
  }
}
