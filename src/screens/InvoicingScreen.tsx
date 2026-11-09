"use client";

/**
 * Two independent documents generated from a booking — same flow, figures and
 * PDF forms as the mobile app's Invoices and Delivery notes screens:
 *  - Invoice: saved through cargo-backend's `/invoices` module, which computes
 *    every amount (India → UAE price for the booking's UOM × repacked bundles,
 *    plus pickup, brand handling and the delivery partner's charge, minus the
 *    receiver's discount) and numbers it. Invoices can't be edited, so one per
 *    booking is kept.
 *  - Delivery note: consignee and the recorded packing list (fetched from
 *    cargo-backend's `/packages` module), one PDF per booking.
 */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { MultiSearchSelect } from "@/components/ui/MultiSearchSelect";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import { canonicalPlace } from "@/services/PricingServices";
import {
  computeBundleMarkIds,
  flattenPackage,
  getAllPackages,
  getPackageByBooking,
  nameOf,
  packageBookingId,
  type PackageItemRow,
} from "@/services/PackageServices";
import { fmtDate, money } from "@/utils/format";
import { downloadDeliveryNoteFormPdf, downloadInvoiceFormPdf, type InvoiceSheet } from "@/utils/formPdf";
import type { DeliveryPartner, Invoice, PricingRoute } from "@/types";

type PackingRow = PackageItemRow;

/** A booking's recorded packing list, flattened to one row per item. */
async function fetchPackingRows(bookingId: string, masters: { products: { id: string; name: string }[]; fabrics: { id: string; name: string }[] }): Promise<PackingRow[]> {
  const pkg = await getPackageByBooking(bookingId);
  return pkg ? flattenPackage(pkg, masters) : [];
}

export function InvoicingScreen() {
  const { bookings, senders, receivers, pricing, deliveryPartners, invoices, containers, stuffings, products, fabrics } = useCargoData();
  const masters = { products: products.items, fabrics: fabrics.items };
  const [containerId, setContainerId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [deliveryPartnerId, setDeliveryPartnerId] = useState("");
  const [generating, setGenerating] = useState(false);
  // Inline fix for a missing / misspelled route price, so the invoice isn't a dead end.
  const [newPrice, setNewPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  // Inline charge for a delivery partner that has none yet — saved to the partner once.
  const [newCharge, setNewCharge] = useState("");
  const [savingCharge, setSavingCharge] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dnContainerId, setDnContainerId] = useState("");
  // Delivery note bookings are multi-select (one PDF per booking).
  const [dnSelected, setDnSelected] = useState<string[]>([]);
  const [dnGenerating, setDnGenerating] = useState(false);
  // Packing list rows per booking id, fetched once per booking and reused for the preview and the PDFs.
  const [packingByBooking, setPackingByBooking] = useState<Record<string, PackingRow[]>>({});

  // Only containers that have had at least one stuffing recorded against them.
  const stuffedContainers = containers.items.filter((c) => stuffings.items.some((s) => s.container === c.id));
  const container = stuffedContainers.find((c) => c.id === containerId);
  // Bookings stuffed into the selected container.
  const containerBookingIds = new Set(stuffings.items.filter((s) => s.container === containerId).flatMap((s) => s.bookings));
  const containerBookings = bookings.items.filter((b) => containerBookingIds.has(b.id));
  const booking = containerBookings.find((b) => b.id === bookingId);
  // cargo-backend allows several invoices per booking; this screen keeps it to one and re-downloads that one instead.
  const existingInvoice = booking ? invoices.items.find((i) => i.bookingId === booking.id) : undefined;

  // Preview only — mirrors cargo-backend's invoice calculation, which is what actually gets saved:
  // India → UAE price for the booking's UOM × repacked bundles, plus the booking's pickup, brand and
  // bundle handling charges and the delivery partner's charge, minus the receiver's flat discount.
  const receiver = receivers.items.find((r) => r.name === booking?.receiver);
  // Same tolerant match as cargo-backend's invoice lookup: any casing, and "Dubai" / "United Arab Emirates" count as UAE.
  const isIndiaUae = (p: PricingRoute) => canonicalPlace(p.from) === "India" && canonicalPlace(p.to) === "UAE";
  const route = pricing.items.find((p) => isIndiaUae(p) && p.uom === booking?.bundleType);
  const otherUoms = pricing.items.filter((p) => isIndiaUae(p) && p.uom !== booking?.bundleType).map((p) => p.uom);
  const unitPrice = route ? Number(route.price) : 0;
  const bundles = booking ? Number(booking.actualBundle || 0) : 0;
  const subtotal = unitPrice * bundles;
  const additionalCharges = booking
    ? Number(booking.pickupCharge || 0) + Number(booking.brandHandlingCharge || 0) + Number(booking.bundleHandlingCharge || 0)
    : 0;
  const discountAmt = receiver ? Number(receiver.discount || 0) : 0;
  // Delivery partner: only active ones, starting on the partner serving the receiver's country
  // (from India when there's a choice); the other active partners follow.
  const receiverCountry = canonicalPlace(receiver?.country);
  const activePartners = deliveryPartners.items.filter((d) => d.status !== "Inactive");
  const matchingPartners = receiverCountry ? activePartners.filter((d) => canonicalPlace(d.toCountry) === receiverCountry) : [];
  const suggestedPartner = matchingPartners.find((d) => canonicalPlace(d.from) === "India") ?? matchingPartners[0];
  const partnerChoices = [...matchingPartners, ...activePartners.filter((d) => !matchingPartners.includes(d))];
  const selectedPartner = activePartners.find((d) => d.id === deliveryPartnerId) ?? suggestedPartner;
  // The charge lives on the delivery partner; when the partner has none yet it's entered here once.
  const hasCharge = (d?: DeliveryPartner) => d !== undefined && d.charge !== undefined && d.charge !== "";
  const deliveryCharge = existingInvoice ? existingInvoice.deliveryCharge : hasCharge(selectedPartner) ? Number(selectedPartner!.charge) : undefined;
  const needsCharge = !existingInvoice && selectedPartner !== undefined && !hasCharge(selectedPartner);
  const total = subtotal + additionalCharges - discountAmt + (deliveryCharge ?? 0);
  const blocker = !booking
    ? ""
    : !existingInvoice && !selectedPartner
      ? activePartners.length
        ? "Choose a delivery partner."
        : "No active delivery partners yet — add one under Masters → Delivery partners."
      : bundles <= 0
        ? "Repacking hasn't been confirmed for this booking yet — the invoice needs its final bundle count."
        : !route
          ? `No India → UAE price for "${booking.bundleType || "this unit"}" yet${otherUoms.length ? ` (priced so far: ${otherUoms.join(", ")})` : ""}.`
          : discountAmt > subtotal + additionalCharges
            ? "The receiver's discount is larger than the invoice amount."
            : needsCharge
              ? `Add ${selectedPartner?.name || "the delivery partner"}'s charge below before generating the invoice.`
              : "";

  const partyOf = (name: string, kind: "sender" | "receiver"): { name: string; lines: string[] } => {
    const found = (kind === "sender" ? senders.items : receivers.items).find((p) => p.name === name);
    return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };

  /** Bundle marks and per-product pieces ("Shirt – 40 pcs") for a booking, from the packing lists. */
  const packingSummary = async (bookingId: string): Promise<{ marks: string; pieces: string[] }> => {
    const packages = await getAllPackages().catch(() => []);
    const markIds = computeBundleMarkIds(packages);
    const pkg = packages.find((p) => packageBookingId(p) === bookingId);
    const bundlesSorted = [...(pkg?.bundles ?? [])].sort((a, b) => a.bundleNo - b.bundleNo);
    const marks = bundlesSorted.map((b) => (b._id ? markIds.get(b._id) : undefined)).filter((m): m is number => m !== undefined);
    const perProduct = new Map<string, number>();
    for (const line of bundlesSorted.flatMap((b) => b.products)) {
      const name = nameOf(line.product, products.items) || "Items";
      perProduct.set(name, (perProduct.get(name) ?? 0) + (Number(line.quantity) || 0));
    }
    const pieces = [...perProduct.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => `${name} – ${n} pcs`);
    return { marks: marks.join(", "), pieces };
  };

  /** Prints a saved invoice on the company's invoice form — every figure comes from the invoice cargo-backend stored. */
  const downloadSavedInvoice = async (invoice: Invoice) => {
    const b = bookings.items.find((x) => x.id === invoice.bookingId);
    const qty = Number(b?.actualBundle || b?.bundleCount || 0);
    const pickup = Number(b?.pickupCharge || 0);
    const brand = Number(b?.brandHandlingCharge || 0);
    const bundle = Number(b?.bundleHandlingCharge || 0);
    // Whatever the total holds beyond the bundles, pickup / brand / bundle handling and discount is the delivery partner's charge.
    const delivery = Math.round((invoice.amount - invoice.subtotal + invoice.receivableDiscount - pickup - brand - bundle) * 100) / 100;
    // The booking's charges may have been edited since — only itemise them if they still add up.
    const split = delivery >= 0;
    const { marks, pieces } = b ? await packingSummary(b.id) : { marks: "", pieces: [] };
    const rows: InvoiceSheet["rows"] = [
      {
        commodity: "GARMENTS",
        pieces,
        particular: b?.bundleType || "Bundle",
        qty,
        rate: qty ? invoice.subtotal / qty : undefined,
        amount: invoice.subtotal,
      },
      ...(split
        ? [
            ...(pickup ? [{ particular: "Pickup charge (without bill)", amount: pickup }] : []),
            ...(brand ? [{ particular: "Brand handling charge", amount: brand }] : []),
            ...(bundle ? [{ particular: "Bundle handling charge", amount: bundle }] : []),
            ...(delivery > 0 ? [{ particular: "Delivery partner charges", amount: delivery }] : []),
          ]
        : invoice.additionalCharges
          ? [{ particular: "Additional charges", amount: invoice.additionalCharges }]
          : []),
      ...(invoice.receivableDiscount ? [{ particular: "Receiver discount", amount: -invoice.receivableDiscount }] : []),
    ];
    // The consignee's place is "location, country" — the booking's own, else the receiver master's (as in the app).
    const rc = receivers.items.find((r) => r.name === b?.receiver);
    const place = [b?.receiverLocation || rc?.location, b?.receiverCountry || rc?.country].filter(Boolean).join(", ");
    const party = { name: b?.receiver ?? "", lines: b ? [place, rc?.whatsapp ? `Ph: ${rc.whatsapp}` : ""] : [] };
    await downloadInvoiceFormPdf(`${invoice.code}.pdf`, [
      {
        // The form prints the phone number as-is (no "Ph:" label).
        consignee: { name: party.name, lines: party.lines.map((l) => l.replace(/^Ph:\s*/, "")) },
        date: fmtDate(invoice.createdAt || b?.date || new Date().toISOString()),
        invoiceNo: invoice.code,
        mark: marks || "-",
        packages: qty ? String(qty) : "-",
        rows,
        total: invoice.amount,
      },
    ]);
  };

  /** Saves the delivery partner's charge (only offered while it has none); it's read-only here afterwards. */
  const saveDeliveryCharge = async () => {
    if (!selectedPartner || newCharge === "" || !(Number(newCharge) >= 0)) return;
    setSavingCharge(true);
    try {
      await deliveryPartners.update(selectedPartner.id, { ...selectedPartner, charge: newCharge });
      setNewCharge("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save the charge.");
    } finally {
      setSavingCharge(false);
    }
  };

  /** Adds the missing India → UAE price for the booking's UOM, so the invoice isn't a dead end. */
  const saveRoutePrice = async () => {
    if (!booking?.bundleType) return;
    setSavingPrice(true);
    try {
      await pricing.create({ from: "India", to: "UAE", uom: booking.bundleType, price: newPrice });
      setNewPrice("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save the price.");
    } finally {
      setSavingPrice(false);
    }
  };

  const generateInvoice = async () => {
    if (!booking || !container) {
      alert("Choose a booking first.");
      return;
    }
    if (existingInvoice) {
      setGenerating(true);
      try {
        await downloadSavedInvoice(existingInvoice);
      } finally {
        setGenerating(false);
      }
      return;
    }
    if (!selectedPartner) {
      alert("Choose a delivery partner.");
      return;
    }
    setGenerating(true);
    try {
      const saved = await invoices.create({ containerId: container.id, bookingId: booking.id, deliveryPartnerId: selectedPartner.id });
      await downloadSavedInvoice(saved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save the invoice.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadFromList = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      await downloadSavedInvoice(invoice);
    } finally {
      setDownloadingId(null);
    }
  };

  // Delivery note follows the same container → booking flow as the invoice.
  const dnContainer = stuffedContainers.find((c) => c.id === dnContainerId);
  const dnContainerBookingIds = new Set(stuffings.items.filter((s) => s.container === dnContainerId).flatMap((s) => s.bookings));
  const dnContainerBookings = bookings.items.filter((b) => dnContainerBookingIds.has(b.id));
  const dnSelectedBookings = dnContainerBookings.filter((b) => dnSelected.includes(b.id));
  // Sender / booking date lines are shown only for a single booking; with several, each group header carries them.
  const dnBooking = dnSelectedBookings.length === 1 ? dnSelectedBookings[0] : undefined;
  const dnLoadingPacking = dnSelected.some((id) => !(id in packingByBooking));
  const dnItemCount = dnSelected.reduce((sum, id) => sum + (packingByBooking[id]?.length ?? 0), 0);

  // Fetch the packing list of every newly selected booking not already cached.
  const dnMissingKey = dnSelected.filter((id) => !(id in packingByBooking)).join(",");
  useEffect(() => {
    if (!dnMissingKey) return;
    dnMissingKey.split(",").forEach((id) => {
      fetchPackingRows(id, masters)
        .catch(() => [] as PackingRow[])
        .then((rows) => setPackingByBooking((prev) => ({ ...prev, [id]: rows })));
    });
    // `masters` is rebuilt every render from `products.items`/`fabrics.items` — re-running this
    // on its identity alone (vs. on the booking selection actually changing) would refetch
    // every already-cached booking's packing list for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dnMissingKey]);

  /** Downloads one delivery note PDF per selected booking. */
  const generateDeliveryNotes = async () => {
    if (dnSelectedBookings.length === 0) {
      alert("Choose at least one booking first.");
      return;
    }
    setDnGenerating(true);
    try {
      for (const b of dnSelectedBookings) {
        const rows = packingByBooking[b.id] ?? (await fetchPackingRows(b.id, masters).catch(() => []));
        await downloadDeliveryNoteFormPdf(`${b.code}-delivery-note.pdf`, {
          lrNo: b.code,
          receiver: partyOf(b.receiver, "receiver"),
          rows: rows.map((l) => ({ bundleNo: String(l.bundleNumber), product: [l.product, l.fabric].filter(Boolean).join(" - "), qty: l.qty })),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't create the PDF.");
    } finally {
      setDnGenerating(false);
    }
  };

  return (
    <div>
      <div className="cc-two-col">
        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-panel-title" style={{ marginBottom: 4 }}>
            Generate invoice
          </div>
          <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
            Amounts are calculated by the server from the booking, its route price and the receiver&apos;s discount.
          </div>
          <Field
            field={{ key: "c", label: "Container", type: "select", options: stuffedContainers.map((c) => c.code) }}
            value={container?.code ?? ""}
            onChange={(_, code) => {
              setContainerId(stuffedContainers.find((c) => c.code === code)?.id ?? "");
              setBookingId("");
              setDeliveryPartnerId("");
            }}
          />
          {container && (
            <Field
              field={{ key: "b", label: "Booking ID", type: "search-select", placeholder: "Choose booking ID", options: containerBookings.map((b) => b.code) }}
              value={booking?.code ?? ""}
              onChange={(_, code) => {
                setBookingId(containerBookings.find((b) => b.code === code)?.id ?? "");
                setDeliveryPartnerId("");
                setNewPrice("");
                setNewCharge("");
              }}
            />
          )}
          {booking && (
            <>
              <div style={{ margin: "12px 0" }}>
                {/* Shown as soon as a booking is picked — not gated on the delivery partner. */}
                <div className="cc-total-row">
                  <span>Receiver</span>
                  <span>{booking.receiver || "—"}</span>
                </div>
                <div className="cc-total-row">
                  <span>Receiver country</span>
                  <span>{receiver?.country || "—"}</span>
                </div>
                <div className="cc-total-row">
                  <span>Route price ({route ? `${route.from} → ${route.to}, per ${route.uom}` : "no route matched"})</span>
                  <span>
                    {money(existingInvoice ? (bundles ? existingInvoice.subtotal / bundles : 0) : unitPrice)} × {bundles}
                  </span>
                </div>
                <div className="cc-total-row">
                  <span>Subtotal</span>
                  <span>{money(existingInvoice?.subtotal ?? subtotal)}</span>
                </div>
                <div className="cc-total-row">
                  <span>Additional charges (pickup + brand + bundle handling)</span>
                  <span>{money(existingInvoice?.additionalCharges ?? additionalCharges)}</span>
                </div>
                <div className="cc-total-row">
                  <span>Receiver discount</span>
                  <span>-{money(existingInvoice?.receivableDiscount ?? discountAmt)}</span>
                </div>
              </div>
              {existingInvoice ? (
                <Field
                  field={{ key: "dp", label: "Delivery partner", type: "text", disabled: true }}
                  value={existingInvoice.deliveryPartner ?? ""}
                  onChange={() => {}}
                />
              ) : (
                <Field
                  field={{ key: "dp", label: "Delivery partner", type: "select", required: true, options: partnerChoices.map((d) => d.name) }}
                  value={selectedPartner?.name ?? ""}
                  onChange={(_, name) => {
                    setDeliveryPartnerId(partnerChoices.find((d) => d.name === name)?.id ?? "");
                    setNewCharge("");
                  }}
                />
              )}
              {/* The partner's From → To countries, as the mobile app shows under each partner. */}
              {(() => {
                const p = existingInvoice ? deliveryPartners.items.find((d) => d.name === existingInvoice.deliveryPartner) : selectedPartner;
                return p && (p.from || p.toCountry) ? (
                  <div className="cc-route-countries">
                    <span className="cc-route-place cc-route-from">{p.from || "—"}</span>
                    <span className="cc-route-line" aria-hidden />
                    <span className="cc-route-place cc-route-to">{p.toCountry || "—"}</span>
                  </div>
                ) : null;
              })()}
              {deliveryCharge !== undefined && (
                <div style={{ margin: "8px 0" }}>
                  <div className="cc-total-row">
                    <span>Delivery partner charge ({(existingInvoice ? existingInvoice.deliveryPartner : selectedPartner?.name) || "—"})</span>
                    <span>+{money(deliveryCharge)}</span>
                  </div>
                </div>
              )}
              {needsCharge && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", margin: "8px 0" }}>
                  <div style={{ flex: 1 }}>
                    <Field
                      field={{ key: "dc", label: "Delivery partner charge (AED)", type: "number", placeholder: "Charge" }}
                      value={newCharge}
                      onChange={(_, v) => setNewCharge(v)}
                    />
                    <div className="cc-panel-desc">Saved to this partner once; it can&apos;t be changed here later.</div>
                  </div>
                  <Button size="sm" onClick={saveDeliveryCharge} loading={savingCharge} disabled={newCharge === "" || !(Number(newCharge) >= 0)}>
                    Save
                  </Button>
                </div>
              )}
              <div className="cc-total-row" style={{ fontWeight: 700, fontSize: 15 }}>
                <span>Total</span>
                <span>{money(existingInvoice ? existingInvoice.amount : total)}</span>
              </div>
              {existingInvoice ? (
                <div className="cc-panel-desc" style={{ marginTop: 6 }}>
                  Already invoiced as <b>{existingInvoice.code}</b>
                  {existingInvoice.createdAt ? ` on ${fmtDate(existingInvoice.createdAt)}` : ""} — downloading reprints the saved invoice.
                </div>
              ) : (
                blocker && <div className="cc-error">{blocker}</div>
              )}
              {!existingInvoice && bundles > 0 && !route && booking.bundleType && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Field
                      field={{ key: "np", label: `India → UAE price per ${booking.bundleType}`, type: "number", placeholder: "Price" }}
                      value={newPrice}
                      onChange={(_, v) => setNewPrice(v)}
                    />
                  </div>
                  <Button size="sm" onClick={saveRoutePrice} loading={savingPrice} disabled={!(Number(newPrice) > 0)}>
                    Add price
                  </Button>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <Button variant="primary" onClick={generateInvoice} loading={generating} disabled={!existingInvoice && !!blocker}>
                  {!generating && <Download size={15} />} {existingInvoice ? "Download invoice PDF" : "Generate & download invoice PDF"}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-panel-title" style={{ marginBottom: 4 }}>
            Generate delivery note
          </div>
          <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
            Packing list, sender and booking date are pulled in automatically.
          </div>
          <Field
            field={{ key: "c2", label: "Container", type: "select", options: stuffedContainers.map((c) => c.code) }}
            value={dnContainer?.code ?? ""}
            onChange={(_, code) => {
              setDnContainerId(stuffedContainers.find((c) => c.code === code)?.id ?? "");
              setDnSelected([]);
            }}
          />
          {dnContainer && (
            <MultiSearchSelect
              label="Booking IDs"
              placeholder="Search booking ID, sender, receiver"
              options={dnContainerBookings.map((b) => ({ value: b.id, label: b.code, hint: `${b.sender} → ${b.receiver}` }))}
              value={dnSelected}
              onChange={setDnSelected}
            />
          )}
          {dnSelectedBookings.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {dnBooking && (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <b>Sender:</b> {dnBooking.sender}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <b>Booking date:</b> {fmtDate(dnBooking.date)}
                  </div>
                </>
              )}
              <div className="cc-mini-label">
                Packing list ({dnItemCount} item{dnItemCount === 1 ? "" : "s"}
                {dnBooking ? "" : ` across ${dnSelectedBookings.length} bookings`})
              </div>
              {dnLoadingPacking && dnItemCount === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Skeleton height={12} width="65%" />
                  <Skeleton height={12} width="55%" />
                  <Skeleton height={12} width="45%" />
                </div>
              ) : dnBooking && dnItemCount === 0 ? (
                <div className="cc-empty">No packing list recorded for this booking yet.</div>
              ) : (
                <div className="cc-table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 10, maxHeight: 320, overflowY: "auto" }}>
                  <table className="cc-table">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Bundle</th>
                        <th>Product</th>
                        <th style={{ width: 80 }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnSelectedBookings.map((b) => {
                        const rows = packingByBooking[b.id];
                        return [
                          // With several bookings, each one gets a group header row above its items.
                          !dnBooking && (
                            <tr key={`${b.id}-head`}>
                              <td colSpan={3} style={{ background: "var(--accent-soft)", color: "var(--accent-dark)", fontWeight: 600 }}>
                                {b.code}
                                <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>
                                  {" "}· {b.sender} → {b.receiver} · {fmtDate(b.date)}
                                </span>
                              </td>
                            </tr>
                          ),
                          rows === undefined ? (
                            <tr key={`${b.id}-loading`}>
                              <td colSpan={3}>
                                <Skeleton height={12} width="55%" />
                              </td>
                            </tr>
                          ) : rows.length === 0 ? (
                            !dnBooking && (
                              <tr key={`${b.id}-empty`}>
                                <td colSpan={3} style={{ color: "var(--text-faint)" }}>
                                  No packing list recorded for this booking yet.
                                </td>
                              </tr>
                            )
                          ) : (
                            rows.map((l, i) => (
                              <tr key={`${b.id}-${i}`}>
                                <td>{l.bundleNumber}</td>
                                <td>{[l.product, l.fabric].filter(Boolean).join(" - ")}</td>
                                <td>{l.qty}</td>
                              </tr>
                            ))
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {dnSelected.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <Button variant="primary" onClick={generateDeliveryNotes} loading={dnGenerating}>
                {!dnGenerating && <Download size={15} />} Generate &amp; download{" "}
                {dnSelected.length === 1 ? "note PDF" : `${dnSelected.length} note PDFs`}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="cc-card" style={{ marginTop: 18 }}>
        <div className="cc-panel-head">
          <div>
            <div className="cc-panel-title">Invoices</div>
            <div className="cc-panel-desc">Every invoice generated so far</div>
          </div>
        </div>
        {invoices.loading ? (
          <SkeletonTable columns={9} />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Invoice number" },
              { key: "createdAt", label: "Date", render: (r) => (r.createdAt ? fmtDate(r.createdAt) : "—") },
              { key: "bookingCode", label: "Booking ID" },
              { key: "container", label: "Container", render: (r) => r.container ?? "—" },
              {
                key: "receiver",
                label: "Receiver",
                render: (r) => {
                  const b = bookings.items.find((x) => x.id === r.bookingId);
                  const country = receivers.items.find((x) => x.name === b?.receiver)?.country;
                  return [b?.receiver, country].filter(Boolean).join(" · ") || "—";
                },
              },
              { key: "deliveryPartner", label: "Delivery partner", render: (r) => r.deliveryPartner ?? "—" },
              { key: "deliveryCharge", label: "Delivery charges", render: (r) => (r.deliveryCharge !== undefined ? money(r.deliveryCharge) : "—") },
              { key: "amount", label: "Total", render: (r) => money(r.amount) },
              {
                key: "download",
                label: "",
                render: (r) => (
                  <Button size="sm" onClick={() => downloadFromList(r)} loading={downloadingId === r.id}>
                    {downloadingId !== r.id && <Download size={14} />} PDF
                  </Button>
                ),
              },
            ]}
            rows={invoices.items}
          />
        )}
      </div>
    </div>
  );
}
