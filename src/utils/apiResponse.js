import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export function ok(data = null, status = 200, headers = undefined) {
  return NextResponse.json({ success: true, data }, { status, headers });
}

export function fail(message, status = 400, details = undefined, headers = undefined) {
  return NextResponse.json(
    { success: false, message, ...(details ? { details } : {}) },
    { status, headers }
  );
}

export function errorResponse(error) {
  if (error instanceof AppError) {
    const headers = error.headers;
    return fail(error.message, error.status, error.details, headers);
  }

  if (error?.name === "ZodError" || Array.isArray(error?.issues)) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    const first = details[0];
    return fail(
      first?.field ? `${first.field}: ${first.message}` : first?.message || "Invalid input.",
      400,
      details
    );
  }

  if (error?.name === "ValidationError") {
    return fail("Some fields are invalid.", 400, Object.values(error.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    })));
  }

  if (error?.name === "CastError") return fail("Invalid identifier.", 400);
  if (error?.code === 11000) return fail("This record already exists.", 409);
  if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
    return fail("Please sign in again.", 401);
  }

  console.error("[API ERROR]", error);
  return fail("Something went wrong. Please try again.", 500);
}
