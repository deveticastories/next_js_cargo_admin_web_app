import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** Assigns a transport (pickup or delivery partner) and LR number to a collection run. Mirrors `PickupAssign` in src/types. */
const pickupAssignSchema = new Schema(
  {
    transport: { type: String, required: true, trim: true },
    lrNo: { type: String, required: true, unique: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(pickupAssignSchema, "PKA");

export const PickupAssign = models.PickupAssign ?? model("PickupAssign", pickupAssignSchema);
