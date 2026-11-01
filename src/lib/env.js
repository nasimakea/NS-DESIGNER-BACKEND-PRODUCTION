// Central, lazy environment access. Nothing here throws at import time so that
// `next build` works without secrets; required values are checked when used.

const isProd = process.env.NODE_ENV === "production";

const str = (name, fallback = "") => String(process.env[name] ?? fallback).trim();
const list = (name, fallback = "") =>
  str(name, fallback)
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const env = {
  isProd,
  mongoUri: str("MONGODB_URI"),
  jwtSecret: str("JWT_SECRET"),
  // How many reverse proxies sit in front of this API (Render = 1, +1 if the
  // website proxies /api to it). The client IP is read from the RIGHT of
  // X-Forwarded-For so it cannot be spoofed by the visitor.
  trustedProxyHops: Math.max(1, Number(str("TRUSTED_PROXY_HOPS", "1")) || 1),
  jwtExpiresIn: str("JWT_EXPIRES_IN", "8h"),
  // Browser origins allowed to call this API (comma separated).
  frontendUrls: list("FRONTEND_URL", "http://localhost:3000"),
  // "lax" works when the frontend proxies /api (recommended). Use "none" only
  // if the browser talks to this API directly from a different site.
  cookieSameSite: str("COOKIE_SAMESITE", "lax").toLowerCase(),
  cloudinary: {
    cloudName: str("CLOUDINARY_CLOUD_NAME"),
    apiKey: str("CLOUDINARY_API_KEY"),
    apiSecret: str("CLOUDINARY_API_SECRET"),
    folder: str("CLOUDINARY_FOLDER", "ns-designer"),
  },
  whatsapp: {
    token: str("WHATSAPP_TOKEN"),
    phoneNumberId: str("WHATSAPP_PHONE_NUMBER_ID"),
    adminNumber: str("WHATSAPP_ADMIN_NUMBER"), // e.g. 917903381728
    templateName: str("WHATSAPP_TEMPLATE_NAME"), // optional approved template
    templateLang: str("WHATSAPP_TEMPLATE_LANG", "en"),
    apiVersion: str("WHATSAPP_API_VERSION", "v21.0"),
  },
  smtp: {
    host: str("SMTP_HOST"),
    port: Number(str("SMTP_PORT", "587")),
    user: str("SMTP_USER"),
    pass: str("SMTP_PASS"),
    from: str("SMTP_FROM", "NS Designer <no-reply@nsdesigner.in>"),
  },
  // Brevo (Sendinblue) transactional e-mail: OTP codes, status updates, chat replies.
  brevo: {
    apiKey: str("BREVO_API_KEY"),
    senderEmail: str("BREVO_SENDER_EMAIL"),
    senderName: str("BREVO_SENDER_NAME", "NS Designer"),
  },
  // Private AI agent service (FastAPI). Never exposed to browsers.
  agent: {
    url: str("AGENT_URL", "http://127.0.0.1:8000").replace(/\/+$/, ""),
    secret: str("AGENT_SHARED_SECRET"),
    timeoutMs: Number(str("AGENT_TIMEOUT_MS", "28000")) || 28000,
  },
  admin: {
    // Used only by `npm run seed` to create the first Super Admin.
    name: str("ADMIN_NAME", "Super Admin"),
    email: str("ADMIN_EMAIL"),
    password: str("ADMIN_PASSWORD"),
  },
};

export function requireEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getJwtSecret() {
  const secret = requireEnv(env.jwtSecret, "JWT_SECRET");
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  return secret;
}
