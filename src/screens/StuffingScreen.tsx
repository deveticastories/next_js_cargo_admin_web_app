"use client";

/**
 * Load bookings sent here from Ready to stuff ("Go to stuffing") into a container. cargo-backend's
 * `POST /stuffings` only records the stuffing itself — unlike the old local-only shim, it has no
 * route to atomically mark bookings stuffed or copy them into the UAE store's incoming log, so
 * `submit` below does those two steps itself right after creating it.
 */

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRightLeft, ChevronDown, ChevronRight, Download, Undo2, X } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { SearchBar } from "@/components/ui/SearchBar";
import { ApiError } from "@/utils/apiClient";
import { computeBundleMarkIds, flattenPackage, getAllPackages, packageBookingId, type PackageDoc } from "@/services/PackageServices";
import { updateStuffStatus } from "@/services/BookingServices";
import { downloadText, fmtDate, money } from "@/utils/format";
import { downloadTablePdf, pdfMoney, type PartyDetails } from "@/utils/pdf";
import { colors } from "@/utils/colors";
import type { Booking } from "@/types";

interface StuffingSummary {
  code: string;
  containerCode: string;
  bookings: Booking[];
}

export function StuffingScreen() {
  const { bookings, containers, stuffings, uaeStoreLog, senders, receivers, invoices, receiptEntries, pricing, products, fabrics } = useCargoData();
  const [containerId, setContainerId] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [stuffedQuery, setStuffedQuery] = useState("");
  // Stuffed list: the stuffing whose Container ID was clicked, expanded into its bookings in place.
  const [openStuffingId, setOpenStuffingId] = useState<string | null>(null);
  // Within that expanded container: the booking whose Booking ID was clicked, expanded into its charges.
  const [openStuffedBookingId, setOpenStuffedBookingId] = useState<string | null>(null);
  // Within that expanded booking: whether its "Number of bundles" has been clicked open into the bundle breakdown.
  const [stuffedBundlesOpen, setStuffedBundlesOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendingBackId, setSendingBackId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastSummary, setLastSummary] = useState<StuffingSummary | null>(null);
  // Every booking's Package, fetched once — feeds the "Bundle mark" columns and the bundle breakdown.
  const [packages, setPackages] = useState<PackageDoc[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAllPackages()
      .then((result) => {
        if (!cancelled) setPackages(result);
      })
      .catch(() => {
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived once per render from `packages` — a bundle's global mark id (see `computeBundleMarkIds`)
  // and which booking each Package belongs to.
  const bundleMarkIds = computeBundleMarkIds(packages);
  const packageByBooking = new Map(packages.map((p) => [packageBookingId(p), p]));
  const bundleMarksFor = (bookingId: string): string =>
    (packageByBooking.get(bookingId)?.bundles ?? [])
      .map((b) => (b._id ? bundleMarkIds.get(b._id) : undefined))
      .filter(Boolean)
      .join(", ");

  const eligible = bookings.items.filter((b) => b.sentToStuffing && !b.stuffed);
  // Already-stuffed containers aren't offered again — same rule as the Containers table's "Stuffed" badge.
  const stuffedContainerIds = new Set(stuffings.items.map((s) => s.container));
  const availableContainers = containers.items.filter((c) => c.status !== "Stuffed" && !stuffedContainerIds.has(c.id));
  // Sender / receiver details, for the expanded container's list and its PDF — the booking's own
  // place first, else the master's, as in the app.
  const senderDetails = (booking?: Booking): PartyDetails => {
    const name = booking?.sender ?? "";
    const found = senders.items.find((p) => p.name === name);
    if (!booking) return { name, lines: [] };
    return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
  };
  const receiverDetails = (booking?: Booking): PartyDetails => {
    const name = booking?.receiver ?? "";
    const found = receivers.items.find((p) => p.name === name);
    if (!booking) return { name, lines: [] };
    const place = [booking.receiverLocation || found?.location, booking.receiverCountry || found?.country].filter(Boolean).join(", ");
    return { name, lines: [place, found?.whatsapp ? `Ph: ${found.whatsapp}` : ""] };
  };

  /**
   * One booking's summary row, as listed under a stuffed container. Amounts come from the booking's
   * invoice (none yet → blank); payment status compares everything received on that invoice against
   * its total.
   */
  const bookingSummaryRow = (bookingId: string, slNo: number): BookingSummaryRowData => {
    const booking = bookings.items.find((b) => b.id === bookingId);
    const invoice = booking ? invoices.items.find((inv) => inv.bookingId === booking.id) : undefined;
    const received = invoice
      ? receiptEntries.items.filter((r) => r.invoiceId === invoice.id).reduce((sum, r) => sum + Number(r.receivedAmount || 0), 0)
      : 0;
    const paymentStatus = !invoice
      ? "Not invoiced"
      : received >= Number(invoice.amount || 0)
        ? "Paid"
        : received > 0
          ? "Partially paid"
          : "Unpaid";
    return {
      id: bookingId,
      bookingId,
      slNo,
      bookingCode: booking?.code ?? "—",
      sender: senderDetails(booking),
      receiver: receiverDetails(booking),
      bundles: booking ? booking.actualBundle || booking.bundleCount : 0,
      bundleMarks: bundleMarksFor(bookingId),
      receivableAmount: invoice ? Number(invoice.amount || 0) : undefined,
      deliveryPartnerAmount: invoice ? Number(invoice.deliveryCharge || 0) : undefined,
      paymentStatus,
    };
  };

  /**
   * A booking's charges breakdown — one row. The booking's own charges come from the booking
   * record; per-bundle charge is the route price for the receiver's location/country (same lookup
   * as Invoicing); total receivable and delivery partner charge come from its invoice, and
   * "After delivery charge" is what's left of the total once the delivery partner is paid.
   */
  /** A booking's charges breakdown row, built on its summary row (bundles, marks, invoice amounts). */
  const bookingChargeRow = (booking: Booking, summary: BookingSummaryRowData): BookingChargeRowData => {
    const senderRec = senders.items.find((p) => p.name === booking.sender);
    const receiverRec = receivers.items.find((p) => p.name === booking.receiver);
    const receiverLocation = booking.receiverLocation || receiverRec?.location || "";
    const receiverCountry = booking.receiverCountry || receiverRec?.country || "";
    const route = pricing.items.find((p) => p.to === receiverLocation || p.to === receiverCountry);
    const { receivableAmount, deliveryPartnerAmount } = summary;
    return {
      id: booking.id,
      slNo: 1,
      bookingCode: booking.code,
      senderName: booking.sender,
      senderContact: senderRec?.whatsapp || "—",
      receiverName: booking.receiver,
      receiverContact: receiverRec?.whatsapp || "—",
      bundles: summary.bundles,
      bundleMarks: summary.bundleMarks,
      pickupCharge: Number(booking.pickupCharge || 0),
      brandHandlingCharge: Number(booking.brandHandlingCharge || 0),
      bundleHandlingCharge: Number(booking.bundleHandlingCharge || 0),
      deliveryPartnerAmount,
      perBundleCharge: route ? Number(route.price || 0) : undefined,
      receivableAmount,
      afterDeliveryCharge: receivableAmount === undefined ? undefined : receivableAmount - (deliveryPartnerAmount ?? 0),
    };
  };

  /**
   * A booking's bundle breakdown — one row per product line of each saved packing list
   * (blank lines skipped). "Minimum bundles" flags bookings under the 5-bundle minimum, the same
   * threshold that brings in the bundle handling charge.
   */
  const bundleItemRowsFor = (booking: Booking, bundleCount: number): BundleItemRowData[] => {
    const pkg = packageByBooking.get(booking.id);
    if (!pkg) return [];
    return flattenPackage(pkg, { products: products.items, fabrics: fabrics.items }, bundleMarkIds).map((row, i) => ({
      id: `${pkg._id}-${i}`,
      slNo: i + 1,
      bookingCode: booking.code,
      bundle: `Bundle ${row.bundleNumber}${row.bundleMarkId ? ` (mark ${row.bundleMarkId})` : ""}`,
      product: row.product || "—",
      qty: row.qty || "—",
      fabric: row.fabric || "—",
      minimumBundles: bundleCount < 5 ? "Below 5" : "5 or more",
      productType: booking.productType || "—",
      billOption: booking.billOption || "—",
    }));
  };

  const pdfMoneyOrDash = (n?: number) => (n === undefined ? "-" : pdfMoney(n));
  // Header block shared by the booking and bundle PDFs — which container / booking they belong to.
  const bookingPdfInfo = (container?: { code: string; company: string }, booking?: Booking): [string, string][] =>
    container && booking
      ? [
          ["Container ID", container.code],
          ["Container Name", container.company],
          ["Booking ID", booking.code],
          ["Booking Date", fmtDate(booking.date)],
        ]
      : [];

  /** Booking charges table → PDF. */
  const downloadBookingCharges = async (container: { code: string; company: string } | undefined, booking: Booking | undefined, chargeRows: BookingChargeRowData[]) => {
    if (!booking || chargeRows.length === 0) return;
    setError("");
    try {
      await downloadTablePdf(`${booking.code}-charges.pdf`, {
        title: "BOOKING CHARGES",
        landscape: true,
        info: bookingPdfInfo(container, booking),
        head: [
          "Sl No", "Booking ID", "Sender Name", "Sender Contact", "Receiver Name", "Receiver Contact", "No. of Bundles", "Bundle Mark",
          "Pickup Charge", "Brand Handling", "Bundle Handling", "Delivery Partner", "Per Bundle", "Total Receivable", "After Delivery",
        ],
        body: chargeRows.map((r) => [
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
  const downloadBundleItems = async (container: { code: string; company: string } | undefined, booking: Booking | undefined, itemRows: BundleItemRowData[]) => {
    if (!booking || itemRows.length === 0) return;
    setError("");
    const totalQty = itemRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    try {
      await downloadTablePdf(`${booking.code}-bundles.pdf`, {
        title: "BUNDLE DETAILS",
        landscape: true,
        info: bookingPdfInfo(container, booking),
        head: ["Sl No", "Booking ID", "Bundles", "Products", "Qty", "Fabrics", "Minimum Bundles", "Branded / Normal", "With / Without Bill"],
        body: itemRows.map((r) => [String(r.slNo), r.bookingCode, r.bundle, r.product, r.qty, r.fabric, r.minimumBundles, r.productType, r.billOption]),
        foot: ["", "", "", "Total Qty", String(totalQty), "", "", "", ""],
      });
    } catch {
      setError("Failed to generate the bundle details PDF.");
    }
  };

  // Stuffed list — one row per stuffing (a container is only ever stuffed once), newest first.
  const sq = stuffedQuery.trim().toLowerCase();
  const stuffedRows = stuffings.items
    .map((s) => {
      const container = containers.items.find((c) => c.id === s.container);
      return {
        id: s.id,
        bookingIds: s.bookings,
        containerCode: container?.code ?? "—",
        containerName: container?.company ?? "—",
        bookingCount: s.bookings.length,
        stuffedDate: s.date ?? "",
      };
    })
    .sort((a, b) => b.stuffedDate.localeCompare(a.stuffedDate))
    .filter((r) => [r.containerCode, r.containerName].some((v) => v.toLowerCase().includes(sq)))
    .map((r, i) => ({ ...r, slNo: i + 1 }));

  /** The Stuffed list itself → PDF — the rows currently shown (search applied), with a total bookings row. */
  const downloadStuffedList = async () => {
    if (stuffedRows.length === 0) return;
    setError("");
    const totalBookings = stuffedRows.reduce((sum, r) => sum + r.bookingCount, 0);
    try {
      await downloadTablePdf("container-list.pdf", {
        title: "CONTAINER LIST",
        info: [
          ["No. of Containers", String(stuffedRows.length)],
          ["No. of Bookings", String(totalBookings)],
          ["Generated On", fmtDate(new Date().toISOString())],
          ...(sq ? [["Filter", stuffedQuery.trim()] as [string, string]] : []),
        ],
        head: ["Sl No", "Container ID", "Container Name", "No. of Bookings", "Stuffed Date"],
        body: stuffedRows.map((r) => [String(r.slNo), r.containerCode, r.containerName, String(r.bookingCount), r.stuffedDate ? fmtDate(r.stuffedDate) : "-"]),
        foot: ["", "", "Total", String(totalBookings), ""],
      });
    } catch {
      setError("Failed to generate the container list PDF.");
    }
  };

  const downloadStuffingList = async (row: (typeof stuffedRows)[number], rows: BookingSummaryRowData[]) => {
    setError("");
    try {
      const sum = (pick: (r: BookingSummaryRowData) => number | undefined) => rows.reduce((n, r) => n + (pick(r) ?? 0), 0);
      const party = (p: PartyDetails) => [p.name, ...p.lines.filter(Boolean)].join(", ");
      await downloadTablePdf(`${row.containerCode}-booking-list.pdf`, {
        title: "CONTAINER BOOKING LIST",
        landscape: true,
        info: [
          ["Container ID", row.containerCode],
          ["Container Name", row.containerName],
          ["Stuffed Date", row.stuffedDate ? fmtDate(row.stuffedDate) : "-"],
          ["No. of Bookings", String(rows.length)],
        ],
        head: ["Booking ID", "Receiver Details", "Bundle Mark", "Bundle Count", "Delivery Partner Payable Amount", "Total Receivable Amount"],
        body: rows.map((r) => [
          r.bookingCode,
          party(r.receiver),
          r.bundleMarks || "-",
          String(r.bundles),
          pdfMoneyOrDash(r.deliveryPartnerAmount),
          pdfMoneyOrDash(r.receivableAmount),
        ]),
        foot: ["", "", "Total", String(sum((r) => r.bundles)), pdfMoney(sum((r) => r.deliveryPartnerAmount)), pdfMoney(sum((r) => r.receivableAmount))],
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
      await updateStuffStatus(id, "Pending");
      await bookings.refetch();
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
      // cargo-backend's `POST /stuffings` only creates the record — no atomic "mark stuffed +
      // copy to UAE log" route like the old local shim had, so both happen here instead.
      const created = await stuffings.create({ container: containerId, bookings: selected });
      await Promise.all(
        stuffedBookings.map(async (b) => {
          await updateStuffStatus(b.id, "Stuffed");
          await uaeStoreLog.create({
            booking: b.id,
            receiver: b.receiver,
            bundles: b.actualBundle || b.bundleCount,
            stuffing: created.id,
            date: created.date,
          });
        })
      );
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
          <div className="cc-panel-title">Stuffed list</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <SearchBar value={stuffedQuery} onChange={setStuffedQuery} placeholder="Search container ID, container name" />
            <Button variant="primary" onClick={downloadStuffedList} disabled={stuffedRows.length === 0}>
              <Download size={15} /> Download PDF
            </Button>
          </div>
        </div>
        {stuffings.loading || containers.loading ? (
          <SkeletonTable columns={5} />
        ) : (
          <DataTable
            emptyText={sq ? `No stuffed containers match \u201c${stuffedQuery}\u201d` : "Nothing has been stuffed yet."}
            columns={[
              { key: "slNo", label: "Sl no." },
              {
                key: "containerCode",
                label: "Container ID",
                render: (r) => (
                  <ExpandLink
                    open={r.id === openStuffingId}
                    label={r.containerCode}
                    what="container's bookings"
                    onClick={() => {
                      setOpenStuffingId(r.id === openStuffingId ? null : r.id);
                      setOpenStuffedBookingId(null);
                      setStuffedBundlesOpen(false);
                    }}
                  />
                ),
              },
              { key: "containerName", label: "Container name" },
              { key: "bookingCount", label: "Number of bookings" },
              { key: "stuffedDate", label: "Stuffed date", render: (r) => (r.stuffedDate ? fmtDate(r.stuffedDate) : "—") },
            ]}
            rows={stuffedRows}
            expandedRowId={openStuffingId}
            renderExpanded={(r) => {
              const rows = r.bookingIds.map((bookingId, i) => bookingSummaryRow(bookingId, i + 1));
              return (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 10px" }}>
                    <div className="cc-panel-title">
                      {r.containerCode} — {r.containerName} · {rows.length} booking{rows.length === 1 ? "" : "s"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" variant="primary" onClick={() => downloadStuffingList(r, rows)} disabled={rows.length === 0}>
                        <Download size={14} /> Download PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpenStuffingId(null);
                          setOpenStuffedBookingId(null);
                          setStuffedBundlesOpen(false);
                        }}
                        aria-label="Close container details"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                  <BookingSummaryTable
                    rows={rows}
                    openBookingId={openStuffedBookingId}
                    onToggleBooking={(id) => {
                      setOpenStuffedBookingId(id === openStuffedBookingId ? null : id);
                      setStuffedBundlesOpen(false);
                    }}
                    renderExpanded={(row) => {
                      const booking = bookings.items.find((b) => b.id === row.bookingId);
                      if (!booking) return <div className="cc-empty">This booking no longer exists.</div>;
                      const chargeRows = [bookingChargeRow(booking, row)];
                      const container = { code: r.containerCode, company: r.containerName };
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 10px" }}>
                            <div className="cc-panel-title">
                              {booking.code} — {booking.sender} → {booking.receiver}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <Button size="sm" variant="primary" onClick={() => downloadBookingCharges(container, booking, chargeRows)}>
                                <Download size={14} /> Download PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setOpenStuffedBookingId(null);
                                  setStuffedBundlesOpen(false);
                                }}
                                aria-label="Close booking details"
                              >
                                <X size={14} />
                              </Button>
                            </div>
                          </div>
                          <BookingChargesTable
                            rows={chargeRows}
                            renderBundles={(c) => (
                              <ExpandLink open={stuffedBundlesOpen} label={String(c.bundles)} what="booking's bundles" onClick={() => setStuffedBundlesOpen(!stuffedBundlesOpen)} />
                            )}
                            expandedRowId={stuffedBundlesOpen ? booking.id : null}
                            renderExpanded={() => {
                              const itemRows = bundleItemRowsFor(booking, row.bundles);
                              return (
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 10px" }}>
                                    <div className="cc-panel-title">{booking.code} — bundles</div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        onClick={() => downloadBundleItems(container, booking, itemRows)}
                                        disabled={itemRows.length === 0}
                                        title={itemRows.length === 0 ? "No packing list saved for this booking yet" : undefined}
                                      >
                                        <Download size={14} /> Download PDF
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setStuffedBundlesOpen(false)} aria-label="Close bundle details">
                                        <X size={14} />
                                      </Button>
                                    </div>
                                  </div>
                                  <BundleItemsTable rows={itemRows} />
                                </div>
                              );
                            }}
                          />
                        </div>
                      );
                    }}
                  />
                </div>
              );
            }}
            pageSize={15}
          />
        )}
      </div>

    </div>
  );
}

interface BookingSummaryRowData {
  id: string;
  bookingId: string;
  slNo: number;
  bookingCode: string;
  sender: PartyDetails;
  receiver: PartyDetails;
  bundles: number;
  bundleMarks: string;
  receivableAmount?: number;
  deliveryPartnerAmount?: number;
  paymentStatus: string;
}

/** A stuffed container's bookings — Booking ID expands a row into `renderExpanded` (its charges). */
function BookingSummaryTable({
  rows,
  openBookingId,
  onToggleBooking,
  renderExpanded,
}: {
  rows: BookingSummaryRowData[];
  openBookingId: string | null;
  onToggleBooking: (bookingId: string) => void;
  renderExpanded: (row: BookingSummaryRowData) => ReactNode;
}) {
  return (
    <DataTable
      emptyText="No bookings recorded for this container."
      columns={[
        { key: "slNo", label: "Sl no." },
        {
          key: "bookingCode",
          label: "Booking ID",
          render: (r) => <ExpandLink open={r.bookingId === openBookingId} label={r.bookingCode} what="booking's charges" onClick={() => onToggleBooking(r.bookingId)} />,
        },
        { key: "sender", label: "Sender details", render: (r) => <PartyCell party={r.sender} /> },
        { key: "receiver", label: "Receiver details", render: (r) => <PartyCell party={r.receiver} /> },
        { key: "bundles", label: "No. of bundles" },
        { key: "bundleMarks", label: "Bundle mark", render: (r) => r.bundleMarks || "—" },
        { key: "receivableAmount", label: "Total receivable amount", render: (r) => (r.receivableAmount === undefined ? "—" : money(r.receivableAmount)) },
        { key: "deliveryPartnerAmount", label: "Delivery partner amount", render: (r) => (r.deliveryPartnerAmount === undefined ? "—" : money(r.deliveryPartnerAmount)) },
        { key: "paymentStatus", label: "Payment status", render: (r) => <Badge value={r.paymentStatus} /> },
      ]}
      rows={rows}
      expandedRowId={rows.find((r) => r.bookingId === openBookingId)?.id ?? null}
      renderExpanded={renderExpanded}
    />
  );
}

interface BookingChargeRowData {
  id: string;
  slNo: number;
  bookingCode: string;
  senderName: string;
  senderContact: string;
  receiverName: string;
  receiverContact: string;
  bundles: number;
  bundleMarks: string;
  pickupCharge: number;
  brandHandlingCharge: number;
  bundleHandlingCharge: number;
  deliveryPartnerAmount?: number;
  perBundleCharge?: number;
  receivableAmount?: number;
  afterDeliveryCharge?: number;
}

/** One booking's charges breakdown. `renderBundles` lets a caller make the bundle count clickable. */
function BookingChargesTable({
  rows,
  renderBundles,
  expandedRowId,
  renderExpanded,
}: {
  rows: BookingChargeRowData[];
  renderBundles?: (row: BookingChargeRowData) => ReactNode;
  expandedRowId?: string | null;
  renderExpanded?: (row: BookingChargeRowData) => ReactNode;
}) {
  const moneyOrDash = (n?: number) => (n === undefined ? "—" : money(n));
  return (
    <DataTable
      columns={[
        { key: "slNo", label: "Sl no." },
        { key: "bookingCode", label: "Booking ID" },
        { key: "senderName", label: "Sender name" },
        { key: "senderContact", label: "Sender contact no." },
        { key: "receiverName", label: "Receiver name" },
        { key: "receiverContact", label: "Receiver contact no." },
        { key: "bundles", label: "Number of bundles", render: renderBundles },
        { key: "bundleMarks", label: "Bundle mark", render: (r) => r.bundleMarks || "—" },
        { key: "pickupCharge", label: "Pickup charge", render: (r) => money(r.pickupCharge) },
        { key: "brandHandlingCharge", label: "Brand handling charge", render: (r) => money(r.brandHandlingCharge) },
        { key: "bundleHandlingCharge", label: "Bundle handling charge", render: (r) => money(r.bundleHandlingCharge) },
        { key: "deliveryPartnerAmount", label: "Delivery partner charge", render: (r) => moneyOrDash(r.deliveryPartnerAmount) },
        { key: "perBundleCharge", label: "Per bundle charge", render: (r) => moneyOrDash(r.perBundleCharge) },
        { key: "receivableAmount", label: "Total receivable amount", render: (r) => moneyOrDash(r.receivableAmount) },
        { key: "afterDeliveryCharge", label: "After delivery charge", render: (r) => moneyOrDash(r.afterDeliveryCharge) },
      ]}
      rows={rows}
      expandedRowId={expandedRowId}
      renderExpanded={renderExpanded}
    />
  );
}

interface BundleItemRowData {
  id: string;
  slNo: number;
  bookingCode: string;
  bundle: string;
  product: string;
  qty: string;
  fabric: string;
  minimumBundles: string;
  productType: string;
  billOption: string;
}

/** One booking's bundle breakdown — a row per product line of its packing list. */
function BundleItemsTable({ rows }: { rows: BundleItemRowData[] }) {
  return (
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
      rows={rows}
    />
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
