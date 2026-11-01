import { timingSafeEqual } from "node:crypto";

// Small, dependency-free helpers used across the API.

/** Remove Mongo operator keys ($where, $ne ...) and dotted keys, deeply. */
export function stripMongoOperators(value, depth = 0) {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => stripMongoOperators(item, depth + 1));
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".") || key === "__proto__") continue;
      clean[key] = stripMongoOperators(val, depth + 1);
    }
    return clean;
  }
  return value;
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove control characters and angle brackets from free text. */
export function cleanText(text) {
  return String(text ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .trim();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Real visitor IP, used for rate limiting.
 *  1. Preferred: the website's proxy forwards the IP it observed in
 *     `x-ns-client-ip`, signed with a shared secret (PROXY_SHARED_SECRET).
 *     A visitor cannot forge it because they do not know the secret.
 *  2. Fallback: read X-Forwarded-For from the right, skipping TRUSTED_PROXY_HOPS
 *     proxies (Render = 1), so a visitor cannot spoof it either.
 */
export function clientIp(request) {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (secret) {
    const given = request.headers.get("x-ns-proxy-secret");
    const forwardedIp = request.headers.get("x-ns-client-ip");
    if (given && forwardedIp && safeEqual(given, secret)) return forwardedIp.slice(0, 64);
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  const hops = Number(process.env.TRUSTED_PROXY_HOPS || 1) || 1;
  return parts[Math.max(0, parts.length - hops)] || "unknown";
}

export function normalizePhone(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Detect the real image type from the file's first bytes. */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return "image/png";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}
