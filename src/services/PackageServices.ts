/**
 * A booking's packing list — cargo-backend's `/packages` module (one
 * `Package` document per booking, holding every bundle). Replaces what used
 * to be `/api/packing-lists` (see the removed `PackingListLocalApi` in
 * `LocalWorkflowServices.ts`). Not a `useCargoData()` collection — fetched ad
 * hoc by whichever screen needs it, same as the old local calls were.
 *
 * Two things the old local store had that cargo-backend's `Package` model
 * doesn't:
 *  - `readySaved` / per-bundle `repackedBy` flags — unnecessary now: a bundle
 *    merely *existing* in `bundles[]` already means it was actually saved
 *    (nothing partial/draft ever reaches the server), and `repackedBy` lives
 *    once per Package, which already matches how `BundleWorkspace` only ever
 *    collects it once per booking at Confirm time.
 *  - a sequential "bundle mark ID" (a physical tag number, global across every
 *    booking). There's no such field anywhere server-side, but every bundle
 *    subdocument gets a real Mongo `_id` (chronologically monotonic) — so the
 *    mark id is derived client-side in `computeBundleMarkIds`, never stored.
 */
import { ApiError, http } from "./httpClient";
import type { BundleLineItem } from "@/types";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

export interface RefOrId {
  _id: string;
  name?: string;
}

export interface PackageProductDoc {
  _id?: string;
  product: string | RefOrId;
  quantity: number;
  fabric?: string | RefOrId;
  description?: string;
}

export interface PackageBundleDoc {
  _id?: string;
  bundleNo: number;
  netWeight: number;
  grossWeight: number;
  products: PackageProductDoc[];
}

export interface PackageDoc {
  _id: string;
  booking: string | RefOrId;
  repackedBy?: string;
  bundles: PackageBundleDoc[];
  createdAt?: string;
}

function idOf(ref: string | RefOrId | undefined): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref._id;
}

/** `pkg.booking` comes back populated on every GET — this works whether it is or isn't. */
export function packageBookingId(pkg: PackageDoc): string {
  return idOf(pkg.booking) ?? "";
}

/** Name for a populated-or-bare-id product/fabric ref, looked up in an already-loaded master list. */
export function nameOf(ref: string | RefOrId | undefined, list: { id: string; name: string }[]): string {
  if (!ref) return "";
  if (typeof ref === "object" && ref.name) return ref.name;
  const id = idOf(ref);
  return list.find((item) => item.id === id)?.name ?? "";
}

export async function getAllPackages(): Promise<PackageDoc[]> {
  const res = await http.get<{ packageList?: PackageDoc[] }>(API_ENDPOINTS.PACKAGES.BASE);
  return res.packageList ?? [];
}

export async function getPackageByBooking(bookingId: string): Promise<PackageDoc | null> {
  try {
    const res = await http.get<{ data: PackageDoc }>(API_ENDPOINTS.PACKAGES.BY_BOOKING(bookingId));
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface BundleProductInput {
  productId: string;
  quantity: number;
  fabricId?: string;
  description?: string;
}

export interface UpsertBundleInput {
  bundleNumber: number;
  netWeight: number;
  grossWeight: number;
  products: BundleProductInput[];
}

/**
 * Creates the booking's Package on its first bundle, otherwise merges this
 * bundle into the existing one (replace-by-`bundleNo`, or append) and PUTs
 * the whole document back — cargo-backend has no per-bundle upsert route.
 * Existing bundles' own `_id`s are preserved untouched so `computeBundleMarkIds`
 * stays stable across edits.
 */
export async function upsertBundle(
  bookingId: string,
  bundle: UpsertBundleInput,
  opts: { repackedBy?: string } = {}
): Promise<PackageDoc> {
  const newBundle = {
    bundleNo: bundle.bundleNumber,
    netWeight: bundle.netWeight,
    grossWeight: bundle.grossWeight,
    products: bundle.products.map((p) => ({
      product: p.productId,
      quantity: p.quantity,
      fabric: p.fabricId || undefined,
      description: p.description || undefined,
    })),
  };

  const existing = await getPackageByBooking(bookingId);

  if (!existing) {
    const payload: Record<string, unknown> = { booking: bookingId, bundles: [newBundle] };
    if (opts.repackedBy) payload.repackedBy = opts.repackedBy;
    const res = await http.post<{ data: PackageDoc }>(API_ENDPOINTS.PACKAGES.BASE, payload);
    return res.data;
  }

  const bundles = existing.bundles.map((b) => ({
    _id: b._id,
    bundleNo: b.bundleNo,
    netWeight: b.netWeight,
    grossWeight: b.grossWeight,
    products: b.products.map((p) => ({ product: idOf(p.product), quantity: p.quantity, fabric: idOf(p.fabric), description: p.description })),
  }));
  const idx = bundles.findIndex((b) => b.bundleNo === bundle.bundleNumber);
  if (idx >= 0) bundles[idx] = { ...newBundle, _id: bundles[idx]._id };
  else bundles.push({ ...newBundle, _id: undefined });

  const payload: Record<string, unknown> = { bundles };
  if (opts.repackedBy !== undefined) payload.repackedBy = opts.repackedBy;
  const res = await http.put<{ data: PackageDoc }>(API_ENDPOINTS.PACKAGES.BY_ID(existing._id), payload);
  return res.data;
}

/** Every bundle `_id` across the given packages, in creation order, mapped to its 1-based global mark id. */
export function computeBundleMarkIds(packages: PackageDoc[]): Map<string, number> {
  const ids = packages
    .flatMap((p) => p.bundles.map((b) => b._id))
    .filter((id): id is string => Boolean(id))
    .sort();
  const map = new Map<string, number>();
  ids.forEach((id, i) => map.set(id, i + 1));
  return map;
}

/** One flattened row per product line of a bundle — the shape every screen's packing-list table expects. */
export interface PackageItemRow extends BundleLineItem {
  bundleNumber: number;
  bundleMarkId?: number;
  repackedBy?: string;
}

export function flattenPackage(
  pkg: PackageDoc,
  masters: { products: { id: string; name: string }[]; fabrics: { id: string; name: string }[] },
  markIds?: Map<string, number>
): PackageItemRow[] {
  const rows: PackageItemRow[] = [];
  for (const bundle of pkg.bundles) {
    for (const product of bundle.products) {
      rows.push({
        bundleNumber: bundle.bundleNo,
        bundleMarkId: bundle._id ? markIds?.get(bundle._id) : undefined,
        repackedBy: pkg.repackedBy ?? "",
        netWeight: String(bundle.netWeight ?? ""),
        grossWeight: String(bundle.grossWeight ?? ""),
        product: nameOf(product.product, masters.products),
        qty: String(product.quantity ?? ""),
        fabric: nameOf(product.fabric, masters.fabrics),
        description: product.description ?? "",
      });
    }
  }
  return rows;
}
