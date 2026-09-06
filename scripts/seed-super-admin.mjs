/**
 * One-off script: creates (or updates the password of) the super admin
 * account used to log into the Cargo Admin panel.
 *
 * Run with: npm run seed:admin
 *
 * Reads SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD / MONGODB_URI from
 * .env.local. This is a plain Node script (not a Next.js module), so it
 * can't import the TypeScript model directly — it defines the same minimal
 * schema shape inline instead. Keep it in sync with
 * src/backend/models/Admin.ts if that schema ever changes.
 */
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

function loadEnvLocal() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const { MONGODB_URI, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } = env;

  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set in .env.local.");
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env.local.");
  }

  const adminSchema = new mongoose.Schema(
    {
      email: { type: String, required: true, unique: true, trim: true, lowercase: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ["SuperAdmin"], default: "SuperAdmin" },
      tokenVersion: { type: Number, default: 0 },
    },
    { timestamps: true }
  );
  const Admin = mongoose.models.Admin ?? mongoose.model("Admin", adminSchema);

  await mongoose.connect(MONGODB_URI);

  const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.tokenVersion += 1; // invalidate any refresh tokens issued under the old password
    await existing.save();
    console.log(`Updated password for existing super admin: ${email}`);
  } else {
    await Admin.create({ email, passwordHash, role: "SuperAdmin" });
    console.log(`Created super admin: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
