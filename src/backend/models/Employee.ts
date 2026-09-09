import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";

/** Admins and employees who use the admin panel. Mirrors `Employee` in src/types. */
const employeeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    empId: { type: String, required: true, unique: true, trim: true },
    contact: { type: String, required: true, trim: true },
    bloodGroup: { type: String, trim: true },
    role: { type: String, enum: ["Admin", "Employee"], required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    // Login credentials, so this employee can sign in to the admin panel
    // themselves instead of sharing the super admin's account. `sparse` lets
    // records with no email coexist under the unique index — see the POST/PATCH
    // overrides in `src/app/api/employees/` for why this isn't just `required`.
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    // `select: false` keeps this out of any query result unless explicitly
    // requested (`.select("+passwordHash")`), same as `Admin.passwordHash`.
    passwordHash: { type: String, select: false },
    // Bumped on logout/deactivation to invalidate refresh tokens issued
    // before that point — mirrors `Admin.tokenVersion`.
    tokenVersion: { type: Number, default: 0 },
  },
  baseSchemaOptions
);

// `models.Employee` reuses the already-compiled model across Next.js dev
// hot-reloads — redefining it with `model()` a second time throws.
export const Employee = models.Employee ?? model("Employee", employeeSchema);
