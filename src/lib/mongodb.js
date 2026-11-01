import mongoose from "mongoose";
import { env, requireEnv } from "./env";

const globalCache = globalThis;
globalCache._nsMongoose ||= { conn: null, promise: null };
const cache = globalCache._nsMongoose;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    requireEnv(env.mongoUri, "MONGODB_URI");
    mongoose.set("strictQuery", true);

    cache.promise = mongoose.connect(env.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
