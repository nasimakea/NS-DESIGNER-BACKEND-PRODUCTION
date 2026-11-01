import { env } from "@/lib/env";

// WhatsApp Business Cloud API (Meta). Everything here is best-effort:
// failures are returned to the caller, never thrown into the customer's request.
//
// NOTE: Meta only lets a business send free-form messages to a number that has
// messaged the business within the last 24 hours. For reliable admin alerts,
// create an approved template and set WHATSAPP_TEMPLATE_NAME.

const configured = () =>
  Boolean(env.whatsapp.token && env.whatsapp.phoneNumberId && env.whatsapp.adminNumber);

const base = () => `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}`;
const headers = () => ({ Authorization: `Bearer ${env.whatsapp.token}` });

async function call(path, init) {
  const response = await fetch(`${base()}${path}`, { ...init, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `WhatsApp API error ${response.status}`);
  }
  return data;
}

async function sendText(to, body) {
  return call("/messages", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
  });
}

async function sendTemplate(to, name, lang, params) {
  return call("/messages", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: lang },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text).slice(0, 200) })) }],
      },
    }),
  });
}

async function uploadPdf(buffer, filename) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  const data = await call("/media", { method: "POST", headers: headers(), body: form });
  return data.id;
}

async function sendDocument(to, mediaId, filename, caption) {
  return call("/messages", {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    }),
  });
}

export function orderSummaryText(order) {
  const lines = order.items.map((i) => `${i.name} (${i.size}, ${i.color}) x${i.quantity}`);
  return [
    "New Order Received!",
    `Order ID: ${order.orderNumber}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.phone}`,
    ...lines,
    `Total: Rs. ${Number(order.total).toLocaleString("en-IN")}`,
    `Address: ${order.deliveryAddress.address}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}`,
  ].join("\n");
}

/** Sends the order alert (+PDF) to the admin number. Returns { sent, error }. */
export async function notifyAdminOfOrder(order, pdfBuffer) {
  if (!configured()) return { sent: false, skipped: true, error: "WhatsApp is not configured." };

  const to = env.whatsapp.adminNumber.replace(/\D/g, "");
  try {
    if (env.whatsapp.templateName) {
      await sendTemplate(to, env.whatsapp.templateName, env.whatsapp.templateLang, [
        order.orderNumber,
        order.customerName,
        order.phone,
        `Rs. ${Number(order.total).toLocaleString("en-IN")}`,
      ]);
    } else {
      await sendText(to, orderSummaryText(order));
    }

    if (pdfBuffer) {
      const filename = `${order.orderNumber}_Order_Details.pdf`;
      const mediaId = await uploadPdf(pdfBuffer, filename);
      await sendDocument(to, mediaId, filename, `Order ${order.orderNumber}`);
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: String(error?.message || error).slice(0, 300) };
  }
}
