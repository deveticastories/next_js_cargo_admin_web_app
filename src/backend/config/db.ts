import mongoose from "mongoose";

/**
 * MongoDB Atlas connection.
 *
 * `connectDB()` is called at the top of every route handler before it
 * touches a model. It's safe to call on every request — the connection is
 * cached (see below) so only the first call actually opens a socket to
 * Atlas.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Next.js reloads route modules on every file change in dev, which would
// normally open a fresh connection to Atlas each time. Stashing the
// connection (and the in-flight connect promise) on `globalThis` survives
// those reloads, and also lets a warm serverless instance reuse a
// connection across invocations instead of reconnecting on every request.
const globalForMongoose = globalThis as typeof globalThis & { _mongooseCache?: MongooseCache };

const cache: MongooseCache = globalForMongoose._mongooseCache ?? { conn: null, promise: null };
globalForMongoose._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable. Copy .env.example to .env.local and set it.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { bufferCommands: false });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Let the next call retry instead of permanently caching a failed connection attempt.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
