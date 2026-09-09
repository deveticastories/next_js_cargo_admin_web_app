import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Employee } from "@/backend/models/Employee";
import { createCrudController, type RouteContext } from "@/backend/controllers/crudController";
import { connectDB } from "@/backend/config/db";
import { requireAuth } from "@/backend/utils/auth";
import { jsonError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

const { DELETE } = createCrudController(Employee).item;

/**
 * Same reasoning as the `POST` override in `../route.ts`: a plain `password`
 * field needs to become `passwordHash` before it's saved. Here a blank/absent
 * password means "keep the current one" — the Team edit form never
 * pre-fills it — so it must never overwrite `passwordHash` with an empty hash.
 */
const PATCH = withErrorHandling(async (req: NextRequest, context: RouteContext) => {
  await requireAuth(req);
  await connectDB();
  const { id } = await context.params;
  const { password, ...body } = await readJsonBody<{ password?: string } & Record<string, unknown>>(req);
  const update: Record<string, unknown> = { ...body };
  if (password) update.passwordHash = await bcrypt.hash(password, 12);

  const doc = await Employee.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!doc) return jsonError("Not found.", 404);
  return NextResponse.json(doc);
});

export { DELETE, PATCH };
