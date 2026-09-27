"use client";

/**
 * Load bookings sent here from Ready to stuff ("Go to stuffing") into a container. Submitting calls
 * `POST /api/stuffings`, which atomically records the stuffing, marks the
 * chosen bookings as stuffed, and copies them into the UAE store's
 * incoming log — then this screen just refetches those two collections.
 */

import { useEffect, useState } from "react";
import { ArrowRightLeft, ChevronDown, ChevronRight, Download, Undo2, X } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { SearchBar } from "@/components/ui/SearchBar";
import { api, ApiError } from "@/utils/apiClient";
import { downloadText, fmtDate, money } from "@/utils/format";
import { downloadContainerManifestPdf, downloadTablePdf, pdfMoney, type PartyDetails } from "@/utils/pdf";
import { colors } from "@/utils/colors";
import type { Booking, PackingList, UaeStoreLogEntry } from "@/types";

interface StuffingSummary {
  code: string;
  containerCode: string;
  bookings: Booking[];
}

export function StuffingScreen() {
  const { bookings, containers, stuffings, uaeStoreLog, senders, receivers, invoices, receiptEntries, pricing } = useCargoData();
  const [containerId, setContainerId] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendingBackId, setSendingBackId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastSummary, setLastSummary] = useState<StuffingSummary | null>(null);
  // UAE store — incoming log: the container whose Container ID was clicked, expanded into its booking list.
  const [openContainerId, setOpenContainerId] = useState<string | null>(null);
  // Within the open container: the booking whose Booking ID was clicked, expanded into its charges breakdown.
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  // Saved packing lists per booking id, in bundle order — for the "Bundle mark" columns and the bundle breakdown.
  const [listsByBooking, setListsByBooking] = useState<Map<string, PackingList[]>>(new Map());
  // Within the open booking: whether its "Number of bundles" has been clicked open into the bundle breakdown.
  const [bundlesOpen, setBundlesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<PackingList[]>("/packing-lists")
      .then((lists) => {
        if (cancelled) return;
        const map = new Map<string, PackingList[]>();
        // Lists come back sorted by bundle number, so each booking's bundles stay in order.
        for (const l of lists) {
          if (!map.has(l.booking)) map.set(l.booking, []);
          map.get(l.booking)!.push(l);
        }
        setListsByBooking(map);
      })
      .catch(() => {
        if (!cancelled) setListsByBooking(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eligible = bookings.items.filter((b) => b.sentToStuffing && !b.stuffed);
  // Already-stuffed containers aren't offered again — same rule as the Containers table's "Stuffed" badge.
  const stuffedContainerIds = new Set(stuffings.items.map((s) => s.container));
  const availableContainers = containers.items.filter((c) => c.status !== "Stuffed" && !stuffedContainerIds.has(c.id));
  // UAE store log entry → its stuffing → that stuffing's container.
  const containerOfLog = (entry: UaeStoreLogEntry) => {
    const containerRef = stuffings.items.find((s) => s.id === entry.stuffing)?.container;
    return containers.items.find((c) => c.id === containerRef);
  };
  // UAE store — incoming log, one row per container: its log entries (one per booking) counted
  // together. Oldest first, same order the per-booking log used to show.
  const incomingByContainer = new Map<string, { id: string; code: string; company: string; stuffingDate?: string; bookingCount: number }>();
  for (const entry of uaeStoreLog.items.slice().reverse()) {
    const container = containerOfLog(entry);
    if (!container) continue;
    const row = incomingByContainer.get(container.id);
    if (row) row.bookingCount += 1;
    else incomingByContainer.set(container.id, { id: container.id, code: container.code, company: container.company, stuffingDate: container.stuffingDate, bookingCount: 1 });
  }
  const incomingRows = [...incomingByContainer.values()].map((r, i) => ({ ...r, slNo: i + 1 }));
  const openContainer = incomingRows.find((r) => r.id === openContainerId);

  // Sender / receiver master details, for the expanded container's list and its PDF.
  const senderDetails = (name: string): PartyDetails => {
    const found = senders.items.find((p) => p.name === name);
    return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };
  const receiverDetails = (name: string): PartyDetails => {
    const found = receivers.items.find((p) => p.name === name);
    return { name, lines: found ? [[found.location, found.country].filter(Boolean).join(", "), found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };

  /**
   * One row per booking stuffed into the open container. Amounts come from the booking's invoice
   * (none yet → blank); payment status compares everything received on that invoice against its total.
   */
  const containerBookingRows = openContainer
    ? uaeStoreLog.items
        .slice()
        .reverse()
        .filter((entry) => containerOfLog(entry)?.id === openContainer.id)
        .map((entry, i) => {
          const booking = bookings.items.find((b) => b.id === entry.booking);
          const code = booking?.code ?? "—";
          const invoice = booking ? invoices.items.find((inv) => inv.bookingCode === booking.code) : undefined;
          const received = invoice
            ? receiptEntries.items.filter((r) => r.invoiceNo === invoice.code).reduce((sum, r) => sum + Number(r.receivedAmount || 0), 0)
            : 0;
          const paymentStatus = !invoice
            ? "Not invoiced"
            : received >= Number(invoice.amount || 0)
              ? "Paid"
              : received > 0
                ? "Partially paid"
                : "Unpaid";
          return {
            id: entry.id,
            bookingId: entry.booking,
            slNo: i + 1,
            bookingCode: code,
            sender: senderDetails(booking?.sender ?? ""),
            receiver: receiverDetails(booking?.receiver ?? entry.receiver),
            bundles: booking ? booking.actualBundle || booking.bundleCount : entry.bundles,
            bundleMarks: (listsByBooking.get(entry.booking) ?? [])
              .map((l) => l.bundleMarkId)
              .filter(Boolean)
              .join(", "),
            receivableAmount: invoice ? Number(invoice.amount || 0) : undefined,
            deliveryPartnerAmount: invoice ? Number(invoice.deliveryCharge || 0) : undefined,
            paymentStatus,
          };
        })
    : [];

  /**
   * The open booking's charges breakdown — one row. The booking's own charges come from the booking
   * record; per-bundle charge is the route price for the receiver's location/country (same lookup
   * as Invoicing); total receivable and delivery partner charge come from its invoice, and
   * "After delivery charge" is what's left of the total once the delivery partner is paid.
   */
  const openBooking = bookings.items.find((b) => b.id === openBookingId);
  const openBookingRow = containerBookingRows.find((r) => r.bookingId === openBookingId);
  const bookingChargeRows =
    openBooking && openBookingRow
      ? (() => {
          const senderRec = senders.items.find((p) => p.name === openBooking.sender);
          const receiverRec = receivers.items.find((p) => p.name === openBooking.receiver);
          const route = pricing.items.find((p) => p.to === receiverRec?.location || p.to === receiverRec?.country);
          const { receivableAmount, deliveryPartnerAmount } = openBookingRow;
          return [
            {
              id: openBooking.id,
              slNo: 1,
              bookingCode: openBooking.code,
              senderName: openBooking.sender,
              senderContact: senderRec?.whatsapp || "—",
              receiverName: openBooking.receiver,
              receiverContact: receiverRec?.whatsapp || "—",
              bundles: openBookingRow.bundles,
              bundleMarks: openBookingRow.bundleMarks,
              pickupCharge: Number(openBooking.pickupCharge || 0),
              brandHandlingCharge: Number(openBooking.brandHandlingCharge || 0),
              bundleHandlingCharge: Number(openBooking.bundleHandlingCharge || 0),
              deliveryPartnerAmount,
              perBundleCharge: route ? Number(route.price || 0) : undefined,
              receivableAmount,
              afterDeliveryCharge:
                receivableAmount === undefined ? undefined : receivableAmount - (deliveryPartnerAmount ?? 0),
            },
          ];
        })()
      : [];
  const moneyOrDash = (n?: number) => (n === undefined ? "—" : money(n));

  /**
   * The open booking's bundle breakdown — one row per product line of each saved packing list
   * (blank lines skipped). "Minimum bundles" flags bookings under the 5-bundle minimum, the same
   * threshold that brings in the bundle handling charge.
   */
  const bundleItemRows = openBooking
    ? (listsByBooking.get(openBooking.id) ?? [])
        .flatMap((list) =>
          list.items
            .filter((item) => item.product || item.qty || item.fabric || item.description)
            .map((item, index) => ({ list, item, index }))
        )
        .map(({ list, item, index }, i) => {
          const bundleCount = openBookingRow?.bundles ?? 0;
          return {
            id: `${list.id}-${index}`,
            slNo: i + 1,
            bookingCode: openBooking.code,
            bundle: `Bundle ${list.bundleNumber}${list.bundleMarkId ? ` (mark ${list.bundleMarkId})` : ""}`,
            product: item.product || "—",
            qty: item.qty || "—",
            fabric: item.fabric || "—",
            minimumBundles: bundleCount < 5 ? "Below 5" : "5 or more",
            productType: openBooking.productType || "—",
            billOption: openBooking.billOption || "—",
          };
        })
    : [];

  const pdfMoneyOrDash = (n?: number) => (n === undefined ? "-" : pdfMoney(n));
  // Header block shared by the booking and bundle PDFs — which container / booking they belong to.
  const bookingPdfInfo = (): [string, string][] =>
    openContainer && openBooking
      ? [
          ["Container ID", openContainer.code],
          ["Container Name", openContainer.company],
          ["Booking ID", openBooking.code],
          ["Booking Date", fmtDate(openBooking.date)],
        ]
      : [];

  /** Booking charges table → PDF. */
  const downloadBookingCharges = async () => {
    if (!openBooking || bookingChargeRows.length === 0) return;
    setError("");
    try {
      await downloadTablePdf(`${openBooking.code}-charges.pdf`, {
        title: "BOOKING CHARGES",
        info: bookingPdfInfo(),
        head: [
          "Sl No", "Booking ID", "Sender Name", "Sender Contact", "Receiver Name", "Receiver Contact", "No. of Bundles", "Bundle Mark",
          "Pickup Charge", "Brand Handling", "Bundle Handling", "Delivery Partner", "Per Bundle", "Total Receivable", "After Delivery",
        ],
        body: bookingChargeRows.map((r) => [
          String(r.slNo),
          r.bookingCode,
          r.senderName,
          r.senderContact,
          r.receiverName,
          r.receiverContact,
          String(r.bundles),
          r.bundleMarks || "-",
          pdfMoney(r.pickupCharge),
          pdfMoney(r.brandHandlingCharge),
          pdfMoney(r.bundleHandlingCharge),
          pdfMoneyOrDash(r.deliveryPartnerAmount),
          pdfMoneyOrDash(r.perBundleCharge),
          pdfMoneyOrDash(r.receivableAmount),
          pdfMoneyOrDash(r.afterDeliveryCharge),
        ]),
      });
    } catch {
      setError("Failed to generate the booking charges PDF.");
    }
  };

  /** Bundle breakdown table → PDF, with a total quantity row. */
  const downloadBundleItems = async () => {
    if (!openBooking || bundleItemRows.length === 0) return;
    setError("");
    const totalQty = bundleItemRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    try {
      await downloadTablePdf(`${openBooking.code}-bundles.pdf`, {
        title: "BUNDLE DETAILS",
        info: bookingPdfInfo(),
        head: ["Sl No", "Booking ID", "Bundles", "Products", "Qty", "Fabrics", "Minimum Bundles", "Branded / Normal", "With / Without Bill"],
        body: bundleItemRows.map((r) => [String(r.slNo), r.bookingCode, r.bundle, r.product, r.qty, r.fabric, r.minimumBundles, r.productType, r.billOption]),
        foot: ["", "", "", "Total Qty", String(totalQty), "", "", "", ""],
      });
    } catch {
      setError("Failed to generate the bundle details PDF.");
    }
  };

  const downloadContainerList = async () => {
    if (!openContainer) return;
    setError("");
    try {
      await downloadContainerManifestPdf(`${openContainer.code}-booking-list.pdf`, {
        containerCode: openContainer.code,
        containerName: openContainer.company,
        stuffedDate: fmtDate(openContainer.stuffingDate),
        rows: containerBookingRows,
      });
    } catch {
      setError("Failed to generate the container booking list PDF.");
    }
  };
  const q = bookingQuery.trim().toLowerCase();
  const visible = eligible.filter((b) => [b.code, b.sender, b.receiver].some((v) => v.toLowerCase().includes(q)));
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  // Header checkbox — selects/clears every booking currently shown (respecting the search filter).
  const allVisibleSelected = visible.length > 0 && visible.every((b) => selected.includes(b.id));
  const someVisibleSelected = visible.some((b) => selected.includes(b.id));
  const toggleAllVisible = () => {
    const visibleIds = visible.map((b) => b.id);
    setSelected(
      allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : [...new Set([...selected, ...visibleIds])]
    );
  };

  /** Undo Ready to stuff's "Go to stuffing" for one booking — it goes back onto that list. */
  const sendBack = async (id: string) => {
    setSendingBackId(id);
    setError("");
    try {
      await bookings.update(id, { sentToStuffing: false });
      setSelected((prev) => prev.filter((x) => x !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send the booking back.");
    } finally {
      setSendingBackId(null);
    }
  };

  const submit = async () => {
    if (!containerId || selected.length === 0) {
      alert("Choose a container and at least one booking.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const stuffedBookings = bookings.items.filter((b) => selected.includes(b.id));
      const created = await api.post<{ code: string }>("/stuffings", { containerId, bookingIds: selected });
      const container = containers.items.find((c) => c.id === containerId);
      setLastSummary({ code: created.code, containerCode: container?.code ?? "", bookings: stuffedBookings });
      await Promise.all([bookings.refetch(), uaeStoreLog.refetch(), containers.refetch(), stuffings.refetch()]);
      setSelected([]);
      setContainerId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit stuffing.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSummary = () => {
    if (!lastSummary) return;
    const rows = lastSummary.bookings.map((b) => `${b.code} | ${b.sender} → ${b.receiver} | ${b.bundleCount} bundles`).join("\n");
    downloadText(`${lastSummary.code}-booking-summary.txt`, `Stuffing ${lastSummary.code} — Container ${lastSummary.containerCode}\n\n${rows}`);
  };

  return (
    <div>
      <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="cc-field" style={{ maxWidth: 360, marginBottom: 14 }}>
          <label>Container</label>
          <select value={containerId} onChange={(e) => setContainerId(e.target.value)}>
            <option value="">Choose a container</option>
            {availableContainers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.company}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="cc-mini-label">Bookings sent from Ready to stuff</div>
          <SearchBar value={bookingQuery} onChange={setBookingQuery} placeholder="Search booking ID, sender, receiver" />
        </div>
        {error && <div className="cc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {bookings.loading ? (
          <SkeletonTable columns={6} rows={3} />
        ) : eligible.length === 0 ? (
          <div className="cc-empty">No bookings waiting — select them on Ready to stuff and click Go to stuffing.</div>
        ) : (
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all bookings"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      disabled={visible.length === 0}
                      onChange={toggleAllVisible}
                    />
                  </th>
                  <th>Booking ID</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Bundles</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="cc-empty">
                      No bookings match &ldquo;{bookingQuery}&rdquo;
                    </td>
                  </tr>
                )}
                {visible.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
                    </td>
                    <td>{b.code}</td>
                    <td>{b.sender}</td>
                    <td>{b.receiver}</td>
                    <td>{b.actualBundle || b.bundleCount}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => sendBack(b.id)}
                        loading={sendingBackId === b.id}
                        disabled={submitting}
                        title="Move this booking back to Ready to stuff"
                      >
                        {sendingBackId !== b.id && <Undo2 size={14} />} Send back
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Button
            variant="primary"
            onClick={submit}
            loading={submitting}
            disabled={!containerId || selected.length === 0}
            title={!containerId ? "Choose a container first" : selected.length === 0 ? "Select at least one booking" : undefined}
          >
            {!submitting && <ArrowRightLeft size={15} />} {submitting ? "Submitting…" : "Submit stuffing"}
          </Button>
        </div>
      </div>

      {lastSummary && (
        <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="cc-mini-label">Stuffing {lastSummary.code} completed</div>
          <div className="cc-note-box" style={{ marginBottom: 12 }}>
            Booking summary was auto-sent to each receiver&apos;s registered WhatsApp number, and the stuffed list has been copied to the UAE store.
          </div>
          <Button onClick={downloadSummary}>
            <Download size={15} /> Download booking summary
          </Button>
        </div>
      )}

      <div className="cc-card">
        <div className="cc-panel-head">
          <div className="cc-panel-title">UAE store — incoming log</div>
        </div>
        {uaeStoreLog.loading ? (
          <SkeletonTable columns={5} />
        ) : (
          <DataTable
            emptyText="Nothing has arrived at the UAE store yet."
            columns={[
              { key: "slNo", label: "Sl no." },
              {
                key: "code",
                label: "Container ID",
                render: (r) => (
                  <ExpandLink
                    open={r.id === openContainerId}
                    label={r.code}
                    what="container's bookings"
                    onClick={() => {
                      setOpenContainerId(r.id === openContainerId ? null : r.id);
                      setOpenBookingId(null);
                      setBundlesOpen(false);
                    }}
                  />
                ),
              },
              { key: "company", label: "Container name" },
              { key: "bookingCount", label: "Number of bookings" },
              { key: "stuffingDate", label: "Stuffed date", render: (r) => (r.stuffingDate ? fmtDate(r.stuffingDate) : "—") },
            ]}
            rows={incomingRows}
          />
        )}
        {openContainer && (
          <div style={{ padding: "0 18px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "16px 0 10px" }}>
              <div className="cc-panel-title">
                {openContainer.code} — {openContainer.company} · {containerBookingRows.length} booking{containerBookingRows.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" onClick={downloadContainerList} disabled={containerBookingRows.length === 0}>
                  <Download size={15} /> Download PDF
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpenContainerId(null);
                    setOpenBookingId(null);
                      setBundlesOpen(false);
                  }}
                  aria-label="Close container details"
                >
                  <X size={15} />
                </Button>
              </div>
            </div>
            <DataTable
              emptyText="No bookings recorded for this container."
              columns={[
                { key: "slNo", label: "Sl no." },
                {
                  key: "bookingCode",
                  label: "Booking ID",
                  render: (r) => (
                    <ExpandLink
                      open={r.bookingId === openBookingId}
                      label={r.bookingCode}
                      what="booking's charges"
                      onClick={() => {
                        setOpenBookingId(r.bookingId === openBookingId ? null : r.bookingId);
                        setBundlesOpen(false);
                      }}
                    />
                  ),
                },
                { key: "sender", label: "Sender details", render: (r) => <PartyCell party={r.sender} /> },
                { key: "receiver", label: "Receiver details", render: (r) => <PartyCell party={r.receiver} /> },
                { key: "bundles", label: "No. of bundles" },
                { key: "bundleMarks", label: "Bundle mark", render: (r) => r.bundleMarks || "—" },
                { key: "receivableAmount", label: "Total receivable amount", render: (r) => (r.receivableAmount === undefined ? "—" : money(r.receivableAmount)) },
                { key: "deliveryPartnerAmount", label: "Delivery partner amount", render: (r) => (r.deliveryPartnerAmount === undefined ? "—" : money(r.deliveryPartnerAmount)) },
                { key: "paymentStatus", label: "Payment status", render: (r) => <Badge value={r.paymentStatus} /> },
              ]}
              rows={containerBookingRows}
            />
            {openBooking && openBookingRow && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div className="cc-panel-title">
                    {openBooking.code} — {openBooking.sender} → {openBooking.receiver}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="primary" onClick={downloadBookingCharges}>
                      <Download size={15} /> Download PDF
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOpenBookingId(null);
                        setBundlesOpen(false);
                      }}
                      aria-label="Close booking details"
                    >
                      <X size={15} />
                    </Button>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: "slNo", label: "Sl no." },
                    { key: "bookingCode", label: "Booking ID" },
                    { key: "senderName", label: "Sender name" },
                    { key: "senderContact", label: "Sender contact no." },
                    { key: "receiverName", label: "Receiver name" },
                    { key: "receiverContact", label: "Receiver contact no." },
                    {
                      key: "bundles",
                      label: "Number of bundles",
                      render: (r) => (
                        <ExpandLink open={bundlesOpen} label={String(r.bundles)} what="booking's bundles" onClick={() => setBundlesOpen(!bundlesOpen)} />
                      ),
                    },
                    { key: "bundleMarks", label: "Bundle mark", render: (r) => r.bundleMarks || "—" },
                    { key: "pickupCharge", label: "Pickup charge", render: (r) => money(r.pickupCharge) },
                    { key: "brandHandlingCharge", label: "Brand handling charge", render: (r) => money(r.brandHandlingCharge) },
                    { key: "bundleHandlingCharge", label: "Bundle handling charge", render: (r) => money(r.bundleHandlingCharge) },
                    { key: "deliveryPartnerAmount", label: "Delivery partner charge", render: (r) => moneyOrDash(r.deliveryPartnerAmount) },
                    { key: "perBundleCharge", label: "Per bundle charge", render: (r) => moneyOrDash(r.perBundleCharge) },
                    { key: "receivableAmount", label: "Total receivable amount", render: (r) => moneyOrDash(r.receivableAmount) },
                    { key: "afterDeliveryCharge", label: "After delivery charge", render: (r) => moneyOrDash(r.afterDeliveryCharge) },
                  ]}
                  rows={bookingChargeRows}
                />
                {bundlesOpen && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div className="cc-panel-title">{openBooking.code} — bundles</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          variant="primary"
                          onClick={downloadBundleItems}
                          disabled={bundleItemRows.length === 0}
                          title={bundleItemRows.length === 0 ? "No packing list saved for this booking yet" : undefined}
                        >
                          <Download size={15} /> Download PDF
                        </Button>
                        <Button variant="ghost" onClick={() => setBundlesOpen(false)} aria-label="Close bundle details">
                          <X size={15} />
                        </Button>
                      </div>
                    </div>
                    <DataTable
                      emptyText="No packing list saved for this booking's bundles."
                      columns={[
                        { key: "slNo", label: "Sl no." },
                        { key: "bookingCode", label: "Booking ID" },
                        { key: "bundle", label: "Bundles" },
                        { key: "product", label: "Products" },
                        { key: "qty", label: "Qty" },
                        { key: "fabric", label: "Fabrics" },
                        { key: "minimumBundles", label: "Minimum bundles" },
                        { key: "productType", label: "Branded / Normal", render: (r) => <Badge value={r.productType} /> },
                        { key: "billOption", label: "With bill / Without bill", render: (r) => <Badge value={r.billOption} /> },
                      ]}
                      rows={bundleItemRows}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Name on top, then location / phone in smaller muted text. */
function PartyCell({ party }: { party: PartyDetails }) {
  return (
    <div>
      <div>{party.name || "—"}</div>
      {party.lines.filter(Boolean).map((line) => (
        <div key={line} style={{ fontSize: 12, color: colors.textSoft }}>
          {line}
        </div>
      ))}
    </div>
  );
}

/** A table cell's clickable ID that expands / collapses a detail table (chevron shows which). */
function ExpandLink({ open, label, what, onClick }: { open: boolean; label: string; what: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title={`${open ? "Hide" : "Show"} this ${what}`}
      style={{ font: "inherit", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", color: colors.accent, fontWeight: 600 }}
    >
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {label}
    </button>
  );
}
