import { NextResponse } from "next/server";
import { connectDB } from "./mongodb";
import { env } from "./env";
import { requireAdmin, requireUser } from "./auth";
import { stripMongoOperators, clientIp } from "./security";
import { checkRateLimit } from "@/middleware/rateLimit";
import { AppError, errorResponse } from "@/utils/apiResponse";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_JSON_BYTES = 256 * 1024;

function originAllowed(request, { required }) {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross-origin and on same-origin POSTs.
    // A missing Origin on a credentialed (admin) mutation is rejected.
    return !required;
  }
  return env.frontendUrls.includes(origin.replace(/\/+$/, ""));
}

/**
 * Wraps a route handler with: origin (CSRF) check, rate limiting, DB connection,
 * authentication/authorization and uniform error handling.
 *
 * options:
 *   auth:     false (public) | true (any admin) | "orders" (a permission key) | ["super_admin"] (roles)
 *   customer: true (signed-in shopper required) | "optional" (shopper if signed in)
 *   limit:    { name, max, windowMs }  per-IP rate limit
 */
export function route(handler, options = {}) {
  const { auth = false, customer = false, limit = { name: "default", max: 120, windowMs: 60_000 } } = options;

  return async function wrapped(request, context) {
    try {
      const method = request.method.toUpperCase();

      if (MUTATING.has(method) && !originAllowed(request, { required: Boolean(auth) || customer === true })) {
        throw new AppError("Request origin is not allowed.", 403);
      }

      const ip = clientIp(request);
      const rate = checkRateLimit(`${limit.name}:${ip}`, limit.max, limit.windowMs);
      if (!rate.ok) {
        const error = new AppError("Too many requests. Please try again shortly.", 429);
        error.headers = { "Retry-After": String(rate.retryAfter) };
        throw error;
      }

      await connectDB();

      const params = context?.params ? await context.params : {};
      const user = auth ? await requireAdmin(request, auth === true ? null : auth) : null;
      const shopper = customer ? await requireUser(request, { optional: customer === "optional" }) : null;

      const result = await handler({ request, params, user, shopper, ip });
      return result instanceof Response ? result : NextResponse.json({ success: true, data: result });
    } catch (error) {
      // Honeypot hits get a normal-looking success so bots learn nothing.
      if (error?.silent) return NextResponse.json({ success: true, data: null });
      return errorResponse(error);
    }
  };
}

/** Parse and validate a JSON body with a zod schema. */
export async function readJson(request, schema) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_JSON_BYTES) throw new AppError("Request body is too large.", 413);

  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new AppError("Content-Type must be application/json.", 415);
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("Invalid JSON body.", 400);
  }

  const clean = stripMongoOperators(raw);
  if (clean && typeof clean.website === "string" && clean.website.trim() !== "") {
    const silent = new AppError("Spam detected.", 200);
    silent.silent = true;
    throw silent;
  }
  return schema.parse(clean);
}

export function pagination(request, defaults = { limit: 20, max: 100 }) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    defaults.max,
    Math.max(1, parseInt(url.searchParams.get("limit") || String(defaults.limit), 10) || defaults.limit)
  );
  return { page, limit, skip: (page - 1) * limit, url };
}
