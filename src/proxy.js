import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Runs in front of every /api request: CORS allow-list + preflight handling.
// Only the origins listed in FRONTEND_URL may call this API from a browser.

export function proxy(request) {
  const origin = request.headers.get("origin");
  const allowed = origin && env.frontendUrls.includes(origin.replace(/\/+$/, ""));

  if (request.method === "OPTIONS") {
    const headers = new Headers();
    if (allowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Access-Control-Max-Age", "600");
      headers.set("Vary", "Origin");
    }
    return new NextResponse(null, { status: allowed ? 204 : 403, headers });
  }

  const response = NextResponse.next();
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export const config = { matcher: "/api/:path*" };
