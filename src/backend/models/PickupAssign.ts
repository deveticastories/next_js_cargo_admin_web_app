import { Schema, model, models } from "mongoose";
import { baseSchemaOptions } from "@/backend/utils/schemaOptions";
import { withCode } from "@/backend/utils/generateCode";

/** Assigns a transport (pickup partner) and LR number to a collection run. Mirrors `PickupAssign` in src/types. */
const pickupAssignSchema = new Schema(
  {
    transport: { type: String, required: true, trim: true },
    lrNo: { type: String, required: true, unique: true, trim: true },
    bundleCount: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    pickupStatus: { type: String, enum: ["Pending", "Collected"], default: "Pending" },
    // Set via the Pickup assign table's own "mark collected" popup, not the create/edit
    // form — see `PickupAssignScreen`. 0 until `pickupStatus` first moves to "Collected".
    collectedBundle: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseSchemaOptions
);
withCode(pickupAssignSchema, "PKA");

export const PickupAssign = models.PickupAssign ?? model("PickupAssign", pickupAssignSchema);
