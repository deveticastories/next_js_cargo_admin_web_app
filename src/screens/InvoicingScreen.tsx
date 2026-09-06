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
import { api } from "@/utils/apiClient";
import { downloadText, fmtDate, money } from "@/utils/format";
import type { BundleLineItem } from "@/types";

export function InvoicingScreen() {
  const { bookings, receivers, pricing, deliveryPartners } = useCargoData();
  const [bookingId, setBookingId] = useState("");
  const [pickupCharge, setPickupCharge] = useState("0");
  const [deliveryPartner, setDeliveryPartner] = useState("");
  const [dnBookingId, setDnBookingId] = useState("");
  const [packingRows, setPackingRows] = useState<BundleLineItem[]>([]);
  const [loadingPackingList, setLoadingPackingList] = useState(false);

  const booking = bookings.items.find((b) => b.id === bookingId);
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
  const total = subtotal - discountAmt + (showPickupCharge ? Number(pickupCharge || 0) : 0) + deliveryCharge;

  const generateInvoice = () => {
    if (!booking) {
      alert("Choose a booking first.");
      return;
    }
    const text = `INVOICE — ${booking.code}\nSender: ${booking.sender}\nReceiver: ${booking.receiver}\nRoute price: ${money(unitPrice)} x ${bundles} bundle(s) = ${money(subtotal)}\nDiscount (${discountPct}%): -${money(discountAmt)}\n${
      showPickupCharge ? `Pickup charge: ${money(pickupCharge)}\n` : ""
    }Delivery partner: ${deliveryPartner || "—"} (${money(deliveryCharge)})\nTOTAL: ${money(total)}`;
    downloadText(`${booking.code}-invoice.txt`, text);
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
        .get<{ items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${dnBookingId}`)
        .then((lists) => {
          if (!cancelled) setPackingRows(lists.flatMap((l) => l.items));
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

  const generateDeliveryNote = () => {
    if (!dnBooking) {
      alert("Choose a booking first.");
      return;
    }
    const rows = packingRows.map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric}`).join("\n") || "No packing list recorded yet.";
    const text = `DELIVERY NOTE — ${dnBooking.code}\nSender: ${dnBooking.sender}\nBooking date: ${fmtDate(dnBooking.date)}\n\nPacking list:\n${rows}`;
    downloadText(`${dnBooking.code}-delivery-note.txt`, text);
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
          field={{ key: "b", label: "Booking ID", type: "select", options: bookings.items.map((b) => b.code) }}
          value={booking?.code ?? ""}
          onChange={(_, code) => setBookingId(bookings.items.find((b) => b.code === code)?.id ?? "")}
        />
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
            <Field field={{ key: "dp", label: "Delivery partner", type: "select", options: deliveryPartners.items.map((d) => d.name) }} value={deliveryPartner} onChange={(_, v) => setDeliveryPartner(v)} />
            <div className="cc-total-row" style={{ fontWeight: 700, fontSize: 15 }}>
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <Button variant="primary" onClick={generateInvoice}>
                <Download size={15} /> Generate &amp; download invoice
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
          field={{ key: "b2", label: "Booking ID", type: "select", options: bookings.items.map((b) => b.code) }}
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
              <div className="cc-empty">Loading…</div>
            ) : packingRows.length === 0 ? (
              <div className="cc-empty">No packing list recorded for this booking yet.</div>
            ) : (
              <ul style={{ fontSize: 12.5, color: "var(--text-soft)", paddingLeft: 18 }}>
                {packingRows.map((l, i) => (
                  <li key={i}>
                    {l.product} — qty {l.qty}, {l.fabric}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <Button variant="primary" onClick={generateDeliveryNote}>
                <Download size={15} /> Generate &amp; download note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
