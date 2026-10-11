/**
 * Transport assignment for a collection run — cargo-backend's
 * `/pickup-assigns` module. `transport` is a PickupPartner reference there
 * (populated on every read); the frontend picks it by partner name, so this
 * resolves name -> id on write.
 */
import type { PickupAssign } from "@/types";
import { createCrudService, fallbackCode, resolveIdByName, statusToBool, statusToStr, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function transportName(ref: unknown, submitted?: Record<string, unknown>): string {
  if (ref && typeof ref === "object" && "name" in ref) return String((ref as { name?: unknown }).name ?? "");
  return (submitted?.transport as string | undefined) ?? "";
}

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): PickupAssign {
  return {
    id: doc._id,
    code: fallbackCode("PUA", doc._id),
    transport: transportName(doc.transport, submitted),
    lrNo: String(doc.lrNo ?? ""),
    bundleCount: Number(doc.bundleCount ?? 0),
    amount: Number(doc.amount ?? 0),
    paymentStatus: (doc.paymentStatus as PickupAssign["paymentStatus"]) ?? "",
    pickupStatus: (doc.pickupStatus as PickupAssign["pickupStatus"]) ?? "",
    collectedBundle: Number(doc.collectedBundle ?? 0),
    status: statusToStr(doc.status),
  };
}

async function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    lrNo: body.lrNo,
    bundleCount: body.bundleCount !== undefined && body.bundleCount !== "" ? Number(body.bundleCount) : undefined,
    amount: body.amount !== undefined && body.amount !== "" ? Number(body.amount) : undefined,
    paymentStatus: body.paymentStatus || undefined,
    pickupStatus: body.pickupStatus || undefined,
    collectedBundle:
      body.collectedBundle !== undefined && body.collectedBundle !== "" ? Number(body.collectedBundle) : undefined,
  };
  if (body.transport) {
    payload.transport = await resolveIdByName(API_ENDPOINTS.PICKUP_PARTNERS.BASE, "pickupPartners", String(body.transport));
  }
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const PickupAssignServices: EntityService<PickupAssign> = createCrudService<PickupAssign>({
  basePath: API_ENDPOINTS.PICKUP_ASSIGNS.BASE,
  listKey: "pickupAssigns",
  itemKey: "pickupAssign",
  toFrontend,
  toBackend,
});
