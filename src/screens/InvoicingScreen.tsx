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
import { api } from "@/utils/apiClient";
import { fmtDate, money } from "@/utils/format";
import { downloadDeliveryNotePdf, downloadInvoicePdf } from "@/utils/pdf";
import type { BundleLineItem } from "@/types";

export function InvoicingScreen() {
  const { bookings, senders, receivers, pricing, deliveryPartners, invoices, containers, stuffings } = useCargoData();
  const [containerId, setContainerId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [pickupCharge, setPickupCharge] = useState("0");
  const [brandHandlingCharge, setBrandHandlingCharge] = useState("0");
  const [deliveryPartner, setDeliveryPartner] = useState("");
  const [dnBookingId, setDnBookingId] = useState("");
  const [packingRows, setPackingRows] = useState<(BundleLineItem & { bundleNumber: number })[]>([]);
  const [loadingPackingList, setLoadingPackingList] = useState(false);

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
  const discountPct = receiver ? Number(receiver.discount || 0) : 0;
  const subtotal = unitPrice * bundles;
  const discountAmt = (subtotal * discountPct) / 100;
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
      ...(discountPct ? [{ description: `Receiver discount (${discountPct}%)`, amount: -discountAmt }] : []),
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

  const dnBooking = bookings.items.find((b) => b.id === dnBookingId);

  useEffect(() => {
    let cancelled = false;
    // Deferred a tick so every branch's setState calls land in their own
    // microtask rather than synchronously inside the effect body.
    queueMicrotask(() => {
      if (cancelled) return;
      if (!dnBookingId) {
        setPackingRows([]);
        return;
      }
      setLoadingPackingList(true);
      api
        .get<{ bundleNumber: number; items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${dnBookingId}`)
        .then((lists) => {
          if (!cancelled) setPackingRows(lists.flatMap((l) => l.items.map((i) => ({ ...i, bundleNumber: l.bundleNumber }))));
        })
        .catch(() => {
          if (!cancelled) setPackingRows([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingPackingList(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [dnBookingId]);

  const generateDeliveryNote = async () => {
    if (!dnBooking) {
      alert("Choose a booking first.");
      return;
    }
    await downloadDeliveryNotePdf(`${dnBooking.code}-delivery-note.pdf`, {
      lrNo: dnBooking.code,
      bookingDate: fmtDate(dnBooking.date),
      sender: partyOf(dnBooking.sender, "sender"),
      receiver: partyOf(dnBooking.receiver, "receiver"),
      rows: packingRows.map((l) => ({ bundleNo: String(l.bundleNumber), product: [l.product, l.fabric].filter(Boolean).join(" - "), qty: l.qty })),
    });
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
                <span>Receiver discount ({discountPct}%)</span>
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
          field={{ key: "b2", label: "Booking ID", type: "search-select", placeholder: "Choose booking ID", options: bookings.items.map((b) => b.code) }}
          value={dnBooking?.code ?? ""}
          onChange={(_, code) => setDnBookingId(bookings.items.find((b) => b.code === code)?.id ?? "")}
        />
        {dnBooking && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div style={{ marginBottom: 6 }}>
              <b>Sender:</b> {dnBooking.sender}
            </div>
            <div style={{ marginBottom: 12 }}>
              <b>Booking date:</b> {fmtDate(dnBooking.date)}
            </div>
            <div className="cc-mini-label">
              Packing list ({packingRows.length} item{packingRows.length === 1 ? "" : "s"})
            </div>
            {loadingPackingList ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skeleton height={12} width="65%" />
                <Skeleton height={12} width="55%" />
                <Skeleton height={12} width="45%" />
              </div>
            ) : packingRows.length === 0 ? (
              <div className="cc-empty">No packing list recorded for this booking yet.</div>
            ) : (
              <div className="cc-table-wrap" style={{ border: "1px solid var(--border)", borderRadius: 10, maxHeight: 240, overflowY: "auto" }}>
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Bundle</th>
                      <th>Product</th>
                      <th style={{ width: 80 }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packingRows.map((l, i) => (
                      <tr key={i}>
                        <td>{l.bundleNumber}</td>
                        <td>{[l.product, l.fabric].filter(Boolean).join(" - ")}</td>
                        <td>{l.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <Button variant="primary" onClick={generateDeliveryNote}>
                <Download size={15} /> Generate &amp; download note PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
