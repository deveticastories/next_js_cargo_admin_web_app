/**
 * Shipments booked in before the receiver is known — cargo-backend's
 * `/pre-bookings` module. Its model is much smaller than the frontend's
 * `PreBooking` type (no pickupOption/billOption/productType/charges — those
 * were never shown on this screen either, just carried along for the old
 * backend's sake), so this only sends what cargo-backend actually stores and
 * fills the rest with harmless defaults for type compatibility.
 */
import type { PreBooking } from "@/types";
import { createCrudService, nextSequentialCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { resolveCustomerIdByName } from "./CustomerServices";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function senderName(ref: unknown, submitted?: Record<string, unknown>): string {
  if (ref && typeof ref === "object" && "name" in ref) return String((ref as { name?: unknown }).name ?? "");
  return (submitted?.sender as string | undefined) ?? "";
}

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): PreBooking {
  return {
    id: doc._id,
    code: String(doc.preBookingId ?? doc._id),
    sender: senderName(doc.sender, submitted),
    phoneNumber: String(doc.phoneNumber ?? ""),
    pickupOption: String(submitted?.pickupOption ?? "Our Pickup Boy"),
    date: String(doc.date ?? submitted?.date ?? ""),
    billOption: (submitted?.billOption as PreBooking["billOption"]) ?? "With Bill",
    bundleCount: Number(doc.bundleCount ?? 0),
    bundleType: (doc.bundleType as PreBooking["bundleType"]) ?? "",
    productType: (submitted?.productType as PreBooking["productType"]) ?? "Normal",
    repackingStatus: (submitted?.repackingStatus as PreBooking["repackingStatus"]) ?? "Repacking Required",
    status: (doc.preBookingStatus as PreBooking["status"]) ?? "Pending",
    stuffed: false,
    brandHandlingCharge: Number(submitted?.brandHandlingCharge ?? 0),
    pickupCharge: Number(submitted?.pickupCharge ?? 0),
    bundleHandlingCharge: 0,
    actualBundle: 0,
  };
}

async function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    phoneNumber: body.phoneNumber,
    date: body.date,
    bundleCount: body.bundleCount !== undefined && body.bundleCount !== "" ? Number(body.bundleCount) : undefined,
    bundleType: body.bundleType,
  };
  // The form never collects a pre-booking ID — cargo-backend still requires
  // one (unique), so a fresh one is generated here on create only.
  const [preBookingId, sender] = await Promise.all([
    body.code ? undefined : nextSequentialCode(API_ENDPOINTS.PRE_BOOKINGS.BASE, "preBookingList", "preBookingId", "PBK"),
    body.sender ? resolveCustomerIdByName(String(body.sender), "Sender") : undefined,
  ]);
  if (!body.code) payload.preBookingId = preBookingId;
  if (body.status) payload.preBookingStatus = body.status;
  if (body.sender) payload.sender = sender;
  return payload;
}

export const PreBookingServices: EntityService<PreBooking> = createCrudService<PreBooking>({
  basePath: API_ENDPOINTS.PRE_BOOKINGS.BASE,
  listKey: "preBookingList",
  itemKey: "preBooking",
  toFrontend,
  toBackend,
});
