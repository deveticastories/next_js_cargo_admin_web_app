import { NextResponse, type NextRequest } from "next/server";
import type { Model } from "mongoose";
import { connectDB } from "@/backend/config/db";
import { requireAuth } from "@/backend/utils/auth";
import { jsonError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Builds the four handlers every simple master-data resource needs:
 * list/create for the collection route, update/remove for the `[id]`
 * route. A model-specific `route.ts` just calls this once — see
 * `src/app/api/employees/route.ts` for the pattern. Only resources with
 * extra workflow logic (e.g. `/api/stuffings`) need a hand-written handler
 * instead. Every handler requires a logged-in admin.
 */
export function createCrudController<T>(model: Model<T>) {
  const GET = withErrorHandling(async (req: NextRequest) => {
    await requireAuth(req);
    await connectDB();
    const docs = await model.find().sort({ createdAt: -1 });
    return NextResponse.json(docs);
  });

  const POST = withErrorHandling(async (req: NextRequest) => {
    await requireAuth(req);
    await connectDB();
    const body = await readJsonBody(req);
    // The body is arbitrary client JSON — Mongoose validates its actual
    // shape against the model's schema at write time, so the cast here
    // just satisfies `create`'s generic signature.
    const doc = await model.create(body as Partial<T>);
    return NextResponse.json(doc, { status: 201 });
  });

  const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
    await requireAuth(req);
    await connectDB();
    const { id } = await context.params;
    const body = await readJsonBody(req);
    const doc = await model.findByIdAndUpdate(id, body as Partial<T>, { new: true, runValidators: true });
    if (!doc) return jsonError("Not found.", 404);
    return NextResponse.json(doc);
  });

  const DELETE = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
    await requireAuth(req);
    await connectDB();
    const { id } = await context.params;
    const doc = await model.findByIdAndDelete(id);
    if (!doc) return jsonError("Not found.", 404);
    return NextResponse.json({ success: true });
  });

  return {
    /** Spread into the collection's `route.ts` (`GET` list, `POST` create). */
    collection: { GET, POST },
    /** Spread into the `[id]/route.ts` (`PATCH` update, `DELETE` remove). */
    item: { PATCH, DELETE },
  };
}
