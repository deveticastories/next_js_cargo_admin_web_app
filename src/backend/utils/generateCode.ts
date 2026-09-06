import type { Model, Schema } from "mongoose";

const pad4 = (n: number): string => String(n).padStart(4, "0");

/**
 * Adds an auto-generated, human-readable `code` field to a schema, e.g.
 * "SND-0001" — the same numbering scheme the frontend mockup used (see
 * `nextId` in `src/utils/format.ts`), just computed server-side so
 * concurrent requests can't hand out the same number.
 *
 * Note: this counts existing documents, so it's good enough for this app's
 * write volume but isn't airtight under heavy concurrent writes — a
 * high-throughput system would use a dedicated counters collection instead.
 */
export function withCode(schema: Schema, prefix: string): void {
  schema.add({ code: { type: String, unique: true } });

  schema.pre("validate", async function assignCode() {
    if (this.get("code")) return;
    const Model = this.constructor as Model<unknown>;
    const count = await Model.countDocuments();
    this.set("code", `${prefix}-${pad4(count + 1)}`);
  });
}
