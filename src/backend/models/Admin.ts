import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";

/**
 * A console admin account. There is exactly one "SuperAdmin" today, seeded
 * by `scripts/seed-super-admin.mjs` — the `role` field exists so more
 * accounts/roles can be added later without a schema change.
 *
 * Not exposed through the generic CRUD controller: admins are only ever
 * read/written by the auth routes in `src/app/api/auth/`.
 */
const adminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // `select: false` keeps this out of any query result unless explicitly requested
    // (`.select("+passwordHash")`), so a stray `Admin.find()` elsewhere can't leak it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["SuperAdmin"], default: "SuperAdmin" },
    // Bumped on logout/password change to invalidate every refresh token that
    // was signed with the old value — see verifyRefreshToken's caller in
    // src/app/api/auth/refresh/route.ts.
    tokenVersion: { type: Number, default: 0 },
  },
  baseSchemaOptions
);

export const Admin = models.Admin ?? model("Admin", adminSchema);
