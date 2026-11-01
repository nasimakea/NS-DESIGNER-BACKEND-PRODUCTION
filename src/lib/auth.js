import jwt from "jsonwebtoken";
import AdminUser from "@/models/AdminUser";
import User from "@/models/User";
import { env, getJwtSecret } from "./env";
import { hasPermission } from "./permissions";
import { AppError } from "@/utils/apiResponse";

export const COOKIE_NAME = "ns_admin_token";
const ISSUER = "ns-designer";
const AUDIENCE = "ns-designer-admin";
const MAX_AGE_SECONDS = 8 * 60 * 60;

export function signAdminToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, tv: user.tokenVersion || 0 },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: env.jwtExpiresIn, issuer: ISSUER, audience: AUDIENCE }
  );
}

export function verifyAdminToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function cookieOptions(maxAge = MAX_AGE_SECONDS) {
  const sameSite = ["lax", "strict", "none"].includes(env.cookieSameSite)
    ? env.cookieSameSite
    : "lax";
  return {
    httpOnly: true,
    secure: env.isProd || sameSite === "none",
    sameSite,
    path: "/",
    maxAge,
  };
}

export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, cookieOptions());
  return response;
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  return response;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

/**
 * Returns the signed-in admin document or throws 401/403.
 *   access = null | true   -> any active admin
 *   access = "orders"      -> must hold that permission (Super Admin always does)
 *   access = { anyOf: ["orders", "customers"] } -> any one of those permissions
 *   access = ["super_admin"] -> must have one of those roles
 */
export async function requireAdmin(request, access = null) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) throw new AppError("Authentication required.", 401);

  let payload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw new AppError("Session expired. Please sign in again.", 401);
  }

  const user = await AdminUser.findById(payload.sub);
  if (!user || !user.active || (user.tokenVersion || 0) !== payload.tv) {
    throw new AppError("Session expired. Please sign in again.", 401);
  }

  if (access && typeof access === "object" && !Array.isArray(access) && Array.isArray(access.anyOf)) {
    if (!access.anyOf.some((key) => hasPermission(user, key))) {
      throw new AppError("You do not have permission to do this.", 403);
    }
  } else if (typeof access === "string") {
    if (!hasPermission(user, access)) {
      throw new AppError("You do not have permission to do this.", 403);
    }
  } else if (Array.isArray(access) && access.length && !access.includes(user.role)) {
    throw new AppError("You do not have permission to do this.", 403);
  }

  return user;
}

// ---------------------------------------------------------------------------
// Shopper (customer) sessions: separate cookie, audience and user collection.
// ---------------------------------------------------------------------------
export const USER_COOKIE_NAME = "ns_user_token";
const USER_AUDIENCE = "ns-designer-customer";
const USER_MAX_AGE = 30 * 24 * 60 * 60;

export function signUserToken(user) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion || 0 }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: USER_MAX_AGE,
    issuer: ISSUER,
    audience: USER_AUDIENCE,
  });
}

export function setUserCookie(response, token) {
  response.cookies.set(USER_COOKIE_NAME, token, cookieOptions(USER_MAX_AGE));
  return response;
}

export function clearUserCookie(response) {
  response.cookies.set(USER_COOKIE_NAME, "", cookieOptions(0));
  return response;
}

/** Returns the signed-in shopper, or null when `optional` and nobody is signed in. */
export async function requireUser(request, { optional = false } = {}) {
  const token = readCookie(request, USER_COOKIE_NAME);
  const fail = () => {
    if (optional) return null;
    throw new AppError("Please sign in to continue.", 401);
  };
  if (!token) return fail();

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], issuer: ISSUER, audience: USER_AUDIENCE });
  } catch {
    return fail();
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active || !user.emailVerified || (user.tokenVersion || 0) !== payload.tv) return fail();
  return user;
}
