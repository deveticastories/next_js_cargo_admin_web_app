import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Employee } from "@/backend/models/Employee";
import { createCrudController } from "@/backend/controllers/crudController";
import { connectDB } from "@/backend/config/db";
import { requireAuth } from "@/backend/utils/auth";
import { HttpError, readJsonBody, withErrorHandling } from "@/backend/utils/apiResponse";

const { GET } = createCrudController(Employee).collection;

/**
 * Employees get their CRUD `GET` from the generic controller, but `POST`
 * needs the extra workflow logic the generic controller doesn't do: the
 * Team form's plain `password` field has to become a bcrypt `passwordHash`
 * before anything reaches the database, and a new team member can't be
 * created without one (they'd have no way to sign in — see
 * `/api/auth/login`). See `[id]/route.ts`'s `PATCH` for the update side.
 */
const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const { password, ...body } = await readJsonBody<{ password?: string } & Record<string, unknown>>(req);
  if (!password) throw new HttpError("Password is required for a new team member.", 400);
  if (!body.email) throw new HttpError("Login email is required for a new team member.", 400);

  const doc = await Employee.create({ ...body, passwordHash: await bcrypt.hash(password, 12) });
  return NextResponse.json(doc, { status: 201 });
});

export { GET, POST };
