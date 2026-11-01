import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  try {
    await connectDB();
    const ready = mongoose.connection.readyState === 1;
    return NextResponse.json({ status: ready ? "ok" : "degraded" }, { status: ready ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: "down" }, { status: 503 });
  }
}
