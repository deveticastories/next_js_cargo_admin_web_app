/**
 * Shipment bookings — cargo-backend's `/bookings` module. `sender`/`receiver`
 * are Customer refs (see `CustomerServices.ts`); `pickupOption` is a ref to
 * an existing `/pickup-assigns` record, picked by LR No, and `pickupPartner` a
 * ref to a `/pickup-partners` record, picked by name — the same way
 * Sender/Receiver are picked by name (store the display field, resolve to id
 * on write). `pickupVia` says how the goods arrive; the backend only requires
 * one of the two refs when it's "Pickup Partner".
 *
 * The backend tracks two things the old local-only store modeled as plain
 * booleans: `packingStatus` ("Ready to Ship" | "Repacking Required", renamed
 * here to the frontend's `repackingStatus`) and `stuffStatus` ("Pending" |
 * "Ready to Stuff" | "Stuffed", collapsed here into `sentToStuffing`/
 * `stuffed`). `stuffStatus` and `packageListStatus` aren't part of the
 * generic edit payload — cargo-backend only changes them through their own
 * PATCH endpoints, exported below alongside the service.
 */
import type { Booking } from "@/types";
import { http } from "./httpClient";
import { resolveCustomerIdByName } from "./CustomerServices";
import {
  createCrudService,
  resolveIdByName,
  statusToBool,
  statusToStr,
  type BackendDoc,
  type EntityService,
} from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function refName(ref: unknown, submitted: unknown): string {
  if (ref && typeof ref === "object" && "name" in ref) return String((ref as { name?: unknown }).name ?? "");
  return typeof submitted === "string" ? submitted : "";
}

function refField(ref: unknown, field: string): string {
  if (ref && typeof ref === "object" && field in ref) return String((ref as Record<string, unknown>)[field] ?? "");
  return "";
}

function pickupLrNo(ref: unknown, submitted?: Record<string, unknown>): string {
  if (ref && typeof ref === "object" && "lrNo" in ref) return String((ref as { lrNo?: unknown }).lrNo ?? "");
  return (submitted?.pickupOption as string | undefined) ?? "";
}

function toFrontend(doc: BackendDoc, submitted?: Record<string, unknown>): Booking {
  const stuffStatus = String(doc.stuffStatus ?? "Pending");
  return {
    id: doc._id,
    code: String(doc.bookingId ?? doc._id),
    sender: refName(doc.sender, submitted?.sender),
    receiver: refName(doc.receiver, submitted?.receiver),
    pickupOption: pickupLrNo(doc.pickupOption, submitted),
    pickupPartner: refName(doc.pickupPartner, submitted?.pickupPartner),
    pickupVia: (doc.pickupVia as Booking["pickupVia"]) ?? (submitted?.pickupVia as Booking["pickupVia"]) ?? "Our Pickup Boy",
    date: String(doc.date ?? submitted?.date ?? ""),
    billOption: (doc.billOption as Booking["billOption"]) ?? "",
    bundleCount: Number(doc.bundleCount ?? 0),
    bundleType: (doc.bundleType as Booking["bundleType"]) ?? "",
    productType: (doc.productType as Booking["productType"]) ?? "",
    repackingStatus: (doc.packingStatus as Booking["repackingStatus"]) ?? "",
    stuffed: stuffStatus === "Stuffed",
    sentToStuffing: stuffStatus !== "Pending",
    brandHandlingCharge: Number(doc.brandHandlingCharge ?? 0),
    pickupCharge: Number(doc.pickupCharge ?? 0),
    bundleHandlingCharge: Number(doc.bundleHandlingCharge ?? 0),
    actualBundle: Number(doc.bundle ?? 0),
    senderLocation: refField(doc.sender, "location"),
    senderCountry: refField(doc.sender, "country"),
    receiverLocation: refField(doc.receiver, "location"),
    receiverCountry: refField(doc.receiver, "country"),
    createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
    status: statusToStr(doc.status),
  };
}

async function toBackend(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    date: body.date,
    billOption: body.billOption || undefined,
    bundleCount: body.bundleCount !== undefined && body.bundleCount !== "" ? Number(body.bundleCount) : undefined,
    bundleType: body.bundleType || undefined,
    productType: body.productType || undefined,
    packingStatus: body.repackingStatus || undefined,
    pickupVia: body.pickupVia || undefined,
    brandHandlingCharge: body.brandHandlingCharge !== undefined ? Number(body.brandHandlingCharge) || 0 : undefined,
    pickupCharge: body.pickupCharge !== undefined ? Number(body.pickupCharge) || 0 : undefined,
    bundleHandlingCharge: body.bundleHandlingCharge !== undefined ? Number(body.bundleHandlingCharge) || 0 : undefined,
  };
  // Independent lookups — resolve them side by side rather than one after another.
  const [sender, receiver, pickupOption, pickupPartner] = await Promise.all([
    body.sender ? resolveCustomerIdByName(String(body.sender), "Sender") : undefined,
    body.receiver ? resolveCustomerIdByName(String(body.receiver), "Receiver") : undefined,
    body.pickupOption
      ? resolveIdByName(API_ENDPOINTS.PICKUP_ASSIGNS.BASE, "pickupAssigns", String(body.pickupOption), "lrNo")
      : undefined,
    body.pickupPartner
      ? resolveIdByName(API_ENDPOINTS.PICKUP_PARTNERS.BASE, "pickupPartners", String(body.pickupPartner))
      : undefined,
  ]);
  if (body.sender) payload.sender = sender;
  if (body.receiver) payload.receiver = receiver;
  // An empty value clears the ref on update (null), e.g. a booking moved off a partner.
  if ("pickupOption" in body) payload.pickupOption = body.pickupOption ? pickupOption : null;
  if ("pickupPartner" in body) payload.pickupPartner = body.pickupPartner ? pickupPartner : null;
  const status = statusToBool(body.status);
  if (status !== undefined) payload.status = status;
  return payload;
}

export const BookingServices: EntityService<Booking> = createCrudService<Booking>({
  basePath: API_ENDPOINTS.BOOKINGS.BASE,
  listKey: "bookingList",
  itemKey: "booking",
  toFrontend,
  toBackend,
});

/** `PATCH /bookings/:id/stuff-status` — the only way cargo-backend accepts a `stuffStatus` change. */
export async function updateStuffStatus(
  id: string,
  stuffStatus: "Pending" | "Ready to Stuff" | "Stuffed"
): Promise<void> {
  await http.patch(API_ENDPOINTS.BOOKINGS.STUFF_STATUS(id), { stuffStatus });
}

/** `PATCH /bookings/:id/package-list-status` — called once every bundle of a booking has a saved packing list. */
export async function markPackageListAdded(id: string): Promise<void> {
  await http.patch(API_ENDPOINTS.BOOKINGS.PACKAGE_LIST_STATUS(id), { packageListStatus: "Added" });
}
