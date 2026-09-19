import type { Model, Schema } from "mongoose";

const pad4 = (n: number): string => String(n).padStart(4, "0");

/**
 * Adds an auto-generated, human-readable `code` field to a schema, e.g.
 * "SND-0001" — the same numbering scheme the frontend mockup used (see
 * `nextId` in `src/utils/format.ts`), just computed server-side so
 * concurrent requests can't hand out the same number.
 *
 * Note: this reads the highest existing code, so it's good enough for this app's
 * write volume but isn't airtight under heavy concurrent writes — a
 * high-throughput system would use a dedicated counters collection instead.
 */
export function withCode(schema: Schema, prefix: string): void {
  schema.add({ code: { type: String, unique: true } });
  schema.pre("validate", async function assignCode() {
    if (this.get("code")) return;
    const Model = this.constructor as Model<unknown>;
    // Derive from the highest existing code, not the document count — after a
    // delete the count reuses a number that is still taken and hits the unique index.
    const last = await Model.findOne({ code: new RegExp(`^${prefix}-\\d+$`) })
      .sort({ code: -1 })
      .select("code")
      .lean<{ code: string }>();
    const lastNumber = last ? parseInt(last.code.slice(prefix.length + 1), 10) : 0;
    this.set("code", `${prefix}-${pad4(lastNumber + 1)}`);
  });
}
