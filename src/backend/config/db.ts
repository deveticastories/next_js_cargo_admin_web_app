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

// How long a query waits for a dropped connection to come back before failing (see `bufferCommands`).
mongoose.set("bufferTimeoutMS", 15_000);

export async function connectDB(): Promise<typeof mongoose> {
  // readyState 1 = connected. A cached connection that has since dropped (Atlas failover,
  // network blip, idle socket closed) falls through and waits for a live connection again.
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable. Copy .env.example to .env.local and set it.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Queries issued while the driver is reconnecting wait (up to `bufferTimeoutMS`) for the
      // connection to come back instead of failing immediately — a brief Atlas blip no longer
      // turns into a "failed to load" error on screen. (Wait limit: `bufferTimeoutMS` above.)
      bufferCommands: true,
      // Fail fast (instead of Mongoose's 30s default) if Atlas is unreachable, so a
      // request shows an error rather than spinning for half a minute.
      serverSelectionTimeoutMS: 10_000,
      // Kill a query stuck on a dead socket instead of letting the request hang forever.
      socketTimeoutMS: 45_000,
      maxPoolSize: 20,
      // Prefer IPv4 — on some networks the IPv6 attempt to Atlas hangs before falling back,
      // which is a common cause of slow first connections.
      family: 4,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Let the next call retry instead of permanently caching a failed connection attempt.
    cache.promise = null;
    cache.conn = null;
    throw err;
  }

  // Connected once but currently reconnecting: the driver reconnects on its own, and with
  // buffering on, the caller's queries simply wait for it.
  return cache.conn;
}
