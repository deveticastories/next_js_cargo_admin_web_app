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
  },
  baseSchemaOptions
);

// `models.Employee` reuses the already-compiled model across Next.js dev
// hot-reloads — redefining it with `model()` a second time throws.
export const Employee = models.Employee ?? model("Employee", employeeSchema);
