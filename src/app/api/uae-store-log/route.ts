import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/backend/config/db";
import { UaeStoreLog } from "@/backend/models/UaeStoreLog";
import { requireAuth } from "@/backend/utils/auth";
import { withErrorHandling } from "@/backend/utils/apiResponse";

/** Read-only: entries are only ever created as a side effect of `POST /api/stuffings`. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);
  await connectDB();
  const entries = await UaeStoreLog.find().sort({ createdAt: -1 });
  return NextResponse.json(entries);
});
