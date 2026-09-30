"use client";

/**
 * Two independent documents generated from a booking:
 *  - Invoice: route price × bundles, minus the receiver's discount, plus
 *    pickup charge (only when booked without bill) and delivery charge.
 *  - Delivery note: sender, booking date and the recorded packing list
 *    (fetched from `/api/packing-lists`, one bundle per row).
 */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MultiSearchSelect } from "@/components/ui/MultiSearchSelect";
import { api } from "@/utils/apiClient";
import { fmtDate, money } from "@/utils/format";
import { downloadDeliveryNotePdf, downloadInvoicePdf } from "@/utils/pdf";
import type { BundleLineItem } from "@/types";

type PackingRow = BundleLineItem & { bundleNumber: number };

/** A booking's recorded packing list, flattened to one row per item. */
async function fetchPackingRows(bookingId: string): Promise<PackingRow[]> {
  const lists = await api.get<{ bundleNumber: number; items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${bookingId}`);
  return lists.flatMap((l) => l.items.map((i) => ({ ...i, bundleNumber: l.bundleNumber })));
}

export function InvoicingScreen() {
  const { bookings, senders, receivers, pricing, deliveryPartners, invoices, containers, stuffings } = useCargoData();
  const [containerId, setContainerId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [pickupCharge, setPickupCharge] = useState("0");
  const [brandHandlingCharge, setBrandHandlingCharge] = useState("0");
  const [deliveryPartner, setDeliveryPartner] = useState("");
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
  const receiver = receivers.items.find((r) => r.name === booking?.receiver);
  const route = pricing.items.find((p) => p.to === receiver?.location || p.to === receiver?.country);
  const unitPrice = route ? Number(route.price) : 0;
  const bundles = booking ? Number(booking.bundleCount || 0) : 0;
  // Receiver discount is a flat amount taken off the subtotal (not a percentage), capped so it never goes negative.
  const discountValue = receiver ? Number(receiver.discount || 0) : 0;
  const subtotal = unitPrice * bundles;
  const discountAmt = Math.min(discountValue, subtotal);
  const dp = deliveryPartners.items.find((d) => d.name === deliveryPartner);
  const deliveryCharge = dp ? Number(dp.charge) : 0;
  const showPickupCharge = booking?.billOption === "Without Bill";
  const showBrandHandlingCharge = booking?.productType === "Branded";
  const total =
    subtotal -
    discountAmt +
    (showPickupCharge ? Number(pickupCharge || 0) : 0) +
    (showBrandHandlingCharge ? Number(brandHandlingCharge || 0) : 0) +
    deliveryCharge;

  const partyOf = (name: string, kind: "sender" | "receiver"): { name: string; lines: string[] } => {
    const found = (kind === "sender" ? senders.items : receivers.items).find((p) => p.name === name);
    return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };

  const generateInvoice = async () => {
    if (!booking) {
      alert("Choose a booking first.");
      return;
    }
    // Save the invoice (one per booking — regenerating refreshes its amount) so Receipt Entry can pick it.
    let invoiceNo = "";
    try {
      const payload = { bookingCode: booking.code, sender: booking.sender, receiver: booking.receiver, container: container?.code ?? "", amount: total, deliveryPartner, deliveryCharge };
      const existing = invoices.items.find((i) => i.bookingCode === booking.code);
      const saved = existing ? await invoices.update(existing.id, payload) : await invoices.create(payload);
      invoiceNo = saved?.code ?? existing?.code ?? "";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save the invoice.");
      return;
    }
    const rows = [
      { description: `Freight to ${route?.to ?? "destination"} (${booking.bundleType || "Bundle"})`, rate: unitPrice, qty: bundles, amount: subtotal },
      ...(discountAmt ? [{ description: "Receiver discount", amount: -discountAmt }] : []),
      ...(deliveryPartner ? [{ description: `Delivery charge (${deliveryPartner})`, amount: deliveryCharge }] : []),
    ];
    await downloadInvoicePdf(`${booking.code}-invoice.pdf`, {
      invoiceNo: invoiceNo || booking.code,
      bookingDate: fmtDate(booking.date),
      receiver: partyOf(booking.receiver, "receiver"),
      rows,
      extraCharges: {},
      withoutBillPickupCharge: showPickupCharge ? Number(pickupCharge || 0) : undefined,
      brandHandlingCharge: showBrandHandlingCharge ? Number(brandHandlingCharge || 0) : undefined,
      total,
    });
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
      fetchPackingRows(id)
        .catch(() => [] as PackingRow[])
        .then((rows) => setPackingByBooking((prev) => ({ ...prev, [id]: rows })));
    });
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
        const rows = packingByBooking[b.id] ?? (await fetchPackingRows(b.id).catch(() => []));
        await downloadDeliveryNotePdf(`${b.code}-delivery-note.pdf`, {
          lrNo: b.code,
          bookingDate: fmtDate(b.date),
          sender: partyOf(b.sender, "sender"),
          receiver: partyOf(b.receiver, "receiver"),
          rows: rows.map((l) => ({ bundleNo: String(l.bundleNumber), product: [l.product, l.fabric].filter(Boolean).join(" - "), qty: l.qty })),
        });
      }
    } finally {
      setDnGenerating(false);
    }
  };

  return (
    <div className="cc-two-col">
      <div className="cc-card" style={{ padding: 18 }}>
        <div className="cc-panel-title" style={{ marginBottom: 4 }}>
          Generate invoice
        </div>
        <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
          Price and discount are fetched automatically from the receiver&apos;s route.
        </div>
        <Field
          field={{ key: "c", label: "Container", type: "select", options: stuffedContainers.map((c) => c.code) }}
          value={container?.code ?? ""}
          onChange={(_, code) => {
            setContainerId(stuffedContainers.find((c) => c.code === code)?.id ?? "");
            setBookingId("");
          }}
        />
        {container && (
          <Field
            field={{ key: "b", label: "Booking ID", type: "search-select", placeholder: "Choose booking ID", options: containerBookings.map((b) => b.code) }}
            value={booking?.code ?? ""}
            onChange={(_, code) => {
              const picked = containerBookings.find((b) => b.code === code);
              setBookingId(picked?.id ?? "");
              // Pre-fill from the charge recorded at booking time, if any — still editable below.
              setPickupCharge(String(picked?.pickupCharge ?? 0));
              setBrandHandlingCharge(String(picked?.brandHandlingCharge ?? 0));
            }}
          />
        )}
        {booking && (
          <>
            <div style={{ margin: "12px 0" }}>
              <div className="cc-total-row">
                <span>Route price ({route ? `${route.from} → ${route.to}` : "no route matched"})</span>
                <span>
                  {money(unitPrice)} × {bundles}
                </span>
              </div>
              <div className="cc-total-row">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="cc-total-row">
                <span>Receiver discount</span>
                <span>-{money(discountAmt)}</span>
              </div>
            </div>
            {showPickupCharge && (
              <Field field={{ key: "pc", label: "Pickup charge (booked without bill)", type: "number" }} value={pickupCharge} onChange={(_, v) => setPickupCharge(v)} />
            )}
            {showBrandHandlingCharge && (
              <Field
                field={{ key: "bhc", label: "Brand handling charge (branded products)", type: "number" }}
                value={brandHandlingCharge}
                onChange={(_, v) => setBrandHandlingCharge(v)}
              />
            )}
            <Field field={{ key: "dp", label: "Delivery partner", type: "select", options: deliveryPartners.items.map((d) => d.name) }} value={deliveryPartner} onChange={(_, v) => setDeliveryPartner(v)} />
            <div className="cc-total-row" style={{ fontWeight: 700, fontSize: 15 }}>
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <Button variant="primary" onClick={generateInvoice}>
                <Download size={15} /> Generate &amp; download invoice PDF
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
  );
}
