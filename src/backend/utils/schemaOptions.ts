import type { SchemaOptions } from "mongoose";

/**
 * Shared options for every model's schema: adds `createdAt`/`updatedAt`,
 * and serializes Mongo's `_id`/`__v` into a plain `id` string on JSON
 * output — the same shape the frontend's `RecordWithId`-based types
 * (`src/types/index.ts`) already expect.
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      const obj = ret as Record<string, unknown> & { _id?: unknown; __v?: unknown };
      obj.id = String(obj._id);
      delete obj._id;
      delete obj.__v;
      return obj;
    },
  },
};
