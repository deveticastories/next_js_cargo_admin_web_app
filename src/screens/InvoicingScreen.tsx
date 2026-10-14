"use client";

/**
 * Two independent documents generated from a booking:
 *  - Invoice: saved through cargo-backend's `/invoices` module, which computes
 *    every amount (India → UAE price for the booking's UOM × repacked bundles,
 *    plus pickup and brand handling charges, minus the receiver's discount)
 *    and numbers it. Invoices can't be edited, so one per booking is kept.
 *  - Delivery note: sender, booking date and the recorded packing list
 *    (fetched from cargo-backend's `/packages` module, one bundle per row).
 */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { MultiSearchSelect } from "@/components/ui/MultiSearchSelect";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";
import { flattenPackage, getPackageByBooking, type PackageItemRow } from "@/services/PackageServices";
import { fmtDate, money } from "@/utils/format";
import { downloadDeliveryNotePdf, downloadInvoicePdf } from "@/utils/pdf";
import type { Invoice } from "@/types";

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
  // India → UAE price for the booking's UOM × repacked bundles, plus the booking's pickup and brand
  // handling charges, minus the receiver's flat discount.
  const receiver = receivers.items.find((r) => r.name === booking?.receiver);
  const route = pricing.items.find((p) => p.from === "India" && p.to === "UAE" && p.uom === booking?.bundleType);
  const unitPrice = route ? Number(route.price) : 0;
  const bundles = booking ? Number(booking.actualBundle || 0) : 0;
  const subtotal = unitPrice * bundles;
  const additionalCharges = booking ? Number(booking.pickupCharge || 0) + Number(booking.brandHandlingCharge || 0) : 0;
  const discountAmt = receiver ? Number(receiver.discount || 0) : 0;
  const total = subtotal + additionalCharges - discountAmt;
  const blocker = !booking
    ? ""
    : bundles <= 0
      ? "Repacking hasn't been confirmed for this booking yet — the invoice needs its final bundle count."
      : !route
        ? `No active India → UAE price for "${booking.bundleType || "this unit"}" — add one under Pricing first.`
        : discountAmt > subtotal + additionalCharges
          ? "The receiver's discount is larger than the invoice amount."
          : "";

  const partyOf = (name: string, kind: "sender" | "receiver"): { name: string; lines: string[] } => {
    const found = (kind === "sender" ? senders.items : receivers.items).find((p) => p.name === name);
    return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };

  /** Prints a saved invoice — every figure comes from the invoice cargo-backend stored. */
  const downloadSavedInvoice = async (invoice: Invoice) => {
    const b = bookings.items.find((x) => x.id === invoice.bookingId);
    const qty = Number(b?.actualBundle || 0);
    const pickup = Number(b?.pickupCharge || 0);
    const brand = Number(b?.brandHandlingCharge || 0);
    // The booking's charges may have been edited since — only itemise them if they still add up.
    const split = pickup + brand === invoice.additionalCharges;
    const rows = [
      {
        description: `Freight India → UAE (${b?.bundleType || "Bundle"})`,
        rate: qty ? invoice.subtotal / qty : undefined,
        qty: qty || undefined,
        amount: invoice.subtotal,
      },
      ...(!split && invoice.additionalCharges ? [{ description: "Additional charges", amount: invoice.additionalCharges }] : []),
      ...(invoice.receivableDiscount ? [{ description: "Receiver discount", amount: -invoice.receivableDiscount }] : []),
    ];
    await downloadInvoicePdf(`${invoice.code}.pdf`, {
      invoiceNo: invoice.code,
      bookingDate: b ? fmtDate(b.date) : "",
      receiver: partyOf(b?.receiver ?? "", "receiver"),
      rows,
      extraCharges: {},
      withoutBillPickupCharge: split && pickup ? pickup : undefined,
      brandHandlingCharge: split && brand ? brand : undefined,
      total: invoice.amount,
    });
  };

  const generateInvoice = async () => {
    if (!booking || !container) {
      alert("Choose a booking first.");
      return;
    }
    if (existingInvoice) {
      await downloadSavedInvoice(existingInvoice);
      return;
    }
    if (!deliveryPartnerId) {
      alert("Choose a delivery partner.");
      return;
    }
    setGenerating(true);
    try {
      const saved = await invoices.create({ containerId: container.id, bookingId: booking.id, deliveryPartnerId });
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
              onChange={(_, code) => setBookingId(containerBookings.find((b) => b.code === code)?.id ?? "")}
            />
          )}
          {booking && (
            <>
              <div style={{ margin: "12px 0" }}>
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
                  <span>Additional charges (pickup + brand handling)</span>
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
                  field={{ key: "dp", label: "Delivery partner", type: "select", required: true, options: deliveryPartners.items.map((d) => d.name) }}
                  value={deliveryPartners.items.find((d) => d.id === deliveryPartnerId)?.name ?? ""}
                  onChange={(_, name) => setDeliveryPartnerId(deliveryPartners.items.find((d) => d.name === name)?.id ?? "")}
                />
              )}
              <div className="cc-total-row" style={{ fontWeight: 700, fontSize: 15 }}>
                <span>Total</span>
                <span>{money(existingInvoice?.amount ?? total)}</span>
              </div>
              {existingInvoice ? (
                <div className="cc-panel-desc" style={{ marginTop: 6 }}>
                  Already invoiced as <b>{existingInvoice.code}</b>
                  {existingInvoice.createdAt ? ` on ${fmtDate(existingInvoice.createdAt)}` : ""} — downloading reprints the saved invoice.
                </div>
              ) : (
                blocker && <div className="cc-error">{blocker}</div>
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
          <SkeletonTable columns={7} />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "Invoice number" },
              { key: "createdAt", label: "Date", render: (r) => (r.createdAt ? fmtDate(r.createdAt) : "—") },
              { key: "bookingCode", label: "Booking ID" },
              { key: "container", label: "Container", render: (r) => r.container ?? "—" },
              { key: "deliveryPartner", label: "Delivery partner", render: (r) => r.deliveryPartner ?? "—" },
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
