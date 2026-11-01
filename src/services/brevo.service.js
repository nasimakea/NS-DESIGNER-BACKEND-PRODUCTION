import { env } from "@/lib/env";
import { AppError } from "@/utils/apiResponse";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const brevoConfigured = () => Boolean(env.brevo.apiKey && env.brevo.senderEmail);

/**
 * Sends one transactional e-mail through Brevo's HTTP API (no SDK needed).
 * In development without a key the message is printed to the console so the
 * OTP flow can still be tested; in production a missing key is an error.
 */
export async function sendEmail({ to, toName = "", subject, html, text }) {
  if (!brevoConfigured()) {
    if (!env.isProd) {
      console.log(`\n[brevo:dev] To: ${to}\n[brevo:dev] Subject: ${subject}\n[brevo:dev] ${text}\n`);
      return { sent: false, dev: true };
    }
    throw new AppError("Email service is not configured. Please contact the store.", 503);
  }

  let response;
  try {
    response = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": env.brevo.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: env.brevo.senderName, email: env.brevo.senderEmail },
        to: [{ email: to, ...(toName ? { name: toName } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    console.error("[brevo] network error:", error?.message);
    throw new AppError("We could not send the email right now. Please try again in a moment.", 502);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[brevo] rejected:", response.status, detail.slice(0, 300));
    throw new AppError("We could not send the email right now. Please try again in a moment.", 502);
  }
  return { sent: true };
}

function shell(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f1ec;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eadfd6">
    <div style="background:#970d2b;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold;letter-spacing:.5px">NS Designer</div>
    <div style="padding:24px;color:#222;font-size:15px;line-height:1.55">
      <h2 style="margin:0 0 12px;font-size:19px">${esc(title)}</h2>${bodyHtml}
    </div>
    <div style="padding:14px 24px;background:#faf6f2;color:#888;font-size:12px">Where Style Meet Stitch &middot; This is an automated message.</div>
  </div></div>`;
}

export async function sendOtpEmail({ to, name, code, purpose, minutes }) {
  const verify = purpose === "verify";
  const subject = verify ? `${code} is your NS Designer verification code` : `${code} is your NS Designer password reset code`;
  const lead = verify ? "Use this code to verify your email and finish creating your account." : "Use this code to reset your password.";
  const html = shell(
    verify ? "Verify your email" : "Reset your password",
    `<p>Hello ${esc(name || "there")},</p><p>${lead}</p>
     <p style="margin:20px 0;text-align:center"><span style="display:inline-block;font-size:32px;letter-spacing:10px;font-weight:bold;background:#f6f1ec;border-radius:12px;padding:14px 22px;color:#970d2b">${esc(code)}</span></p>
     <p>This code expires in ${minutes} minutes. If you did not ask for it, you can ignore this email - nobody can access your account without the code.</p>
     <p style="color:#b00020"><strong>Never share this code with anyone.</strong> NS Designer staff will never ask for it.</p>`
  );
  const text = `Your NS Designer ${verify ? "verification" : "password reset"} code is ${code}. It expires in ${minutes} minutes. Never share it with anyone.`;
  return sendEmail({ to, toName: name, subject, html, text });
}

export async function sendOrderStatusEmail({ to, name, orderNumber, status, balance }) {
  const owing = balance > 0 ? `<p>Balance remaining: <strong>Rs. ${Number(balance).toLocaleString("en-IN")}</strong></p>` : "";
  const html = shell(
    `Order ${orderNumber}: ${status}`,
    `<p>Hello ${esc(name)},</p><p>Your order <strong>${esc(orderNumber)}</strong> is now <strong>${esc(status)}</strong>.</p>${owing}<p>You can follow every step in <em>My Account &rarr; Orders</em> on our website.</p>`
  );
  return sendEmail({ to, toName: name, subject: `Order ${orderNumber} - ${status}`, html, text: `Your order ${orderNumber} is now ${status}.` });
}

export async function sendChatReplyEmail({ to, name }) {
  const html = shell(
    "The NS Designer team replied",
    `<p>Hello ${esc(name)},</p><p>Our team has replied to your chat. Open the <strong>Chat</strong> page on our website to read it and continue the conversation.</p>`
  );
  return sendEmail({ to, toName: name, subject: "NS Designer replied to your chat", html, text: "Our team replied to your chat. Open the Chat page on our website." });
}
