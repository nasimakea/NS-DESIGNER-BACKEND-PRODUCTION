import nodemailer from "nodemailer";
import { env } from "@/lib/env";

let transporter = null;

function getTransporter() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Best-effort customer confirmation. Returns true if sent. */
export async function sendOrderConfirmationEmail(order) {
  const mailer = getTransporter();
  if (!mailer || !order.email) return false;

  const rows = order.items
    .map((i) => `<li>${esc(i.name)} - ${esc(i.size)} / ${esc(i.color)} x ${i.quantity}</li>`)
    .join("");

  await mailer.sendMail({
    from: env.smtp.from,
    to: order.email,
    subject: `Your NS Designer order ${order.orderNumber}`,
    html: `<p>Hello ${esc(order.customerName)},</p>
      <p>Thank you for your order request <strong>${esc(order.orderNumber)}</strong>. We will contact you shortly to confirm details.</p>
      <ul>${rows}</ul>
      <p><strong>Total: Rs. ${Number(order.total).toLocaleString("en-IN")}</strong></p>
      <p>- NS Designer</p>`,
  });
  return true;
}
