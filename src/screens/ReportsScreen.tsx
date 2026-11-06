"use client";

/**
 * Reports — same as the mobile app's Reports screen: pick a From / To range
 * (defaults to the current month) and see the stuffed bookings made in it,
 * grouped container-wise, country-wise (receiver's country), customer-wise
 * (sender) or by delivery partner (from the invoice), with a PDF per group.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { computeBundleMarkIds, getAllPackages, packageBookingId, type PackageDoc } from "@/services/PackageServices";
import { fmtDate, money } from "@/utils/format";
import { downloadTablePdf } from "@/utils/pdf";
import type { Booking } from "@/types";

type GroupBy = "container" | "country" | "customer" | "partner";

const TABS: { key: GroupBy; label: string }[] = [
  { key: "container", label: "Container" },
  { key: "country", label: "Country" },
  { key: "customer", label: "Customer" },
  { key: "partner", label: "Delivery Partner" },
];
const GROUP_LABELS: Record<GroupBy, string> = { container: "Container", country: "Country", customer: "Customer", partner: "Delivery Partner" };

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (y: number, m: number) => `${y}-${pad(m + 1)}-01`;
const monthEnd = (y: number, m: number) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
/** A booking's date as a local "YYYY-MM-DD", comparable with the date inputs. */
const localDay = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
};

interface ReportRow {
  id: string;
  booking: Booking;
  day: string;
  receiver: { name: string; location: string; contact: string };
  bundleMarks: string;
  bundles: number;
  partner: string;
  invoiced: boolean;
  payable: number;
  receivable: number;
}

interface ReportGroup {
  key: string;
  label: string;
  sublabel?: string;
  rows: ReportRow[];
  bundles: number;
  payable: number;
  receivable: number;
}

export function ReportsScreen() {
  const { bookings, containers, stuffings, senders, receivers, invoices } = useCargoData();
  const loading = bookings.loading || containers.loading || stuffings.loading || invoices.loading;

  const now = new Date();
  const [from, setFrom] = useState(monthStart(now.getFullYear(), now.getMonth()));
  const [to, setTo] = useState(monthEnd(now.getFullYear(), now.getMonth()));
  const [groupBy, setGroupBy] = useState<GroupBy>("container");
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The group whose PDF is being made.
  const [downloading, setDownloading] = useState<string | null>(null);
  // Every booking's Package, fetched once — feeds the bundle marks.
  const [packages, setPackages] = useState<PackageDoc[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAllPackages()
      .then((result) => !cancelled && setPackages(result))
      .catch(() => !cancelled && setPackages([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const bundleMarksFor = useMemo(() => {
    const markIds = computeBundleMarkIds(packages);
    const byBooking = new Map(packages.map((p) => [packageBookingId(p), p]));
    return (bookingId: string) =>
      [...(byBooking.get(bookingId)?.bundles ?? [])]
        .sort((a, b) => a.bundleNo - b.bundleNo)
        .map((b) => (b._id ? markIds.get(b._id) : undefined))
        .filter(Boolean)
        .join(", ");
  }, [packages]);

  // The container each stuffed booking went into.
  const containerOf = useMemo(() => {
    const map = new Map<string, { id: string; label: string; sublabel: string }>();
    for (const st of stuffings.items) {
      const c = containers.items.find((x) => x.id === st.container);
      for (const id of st.bookings) map.set(id, { id: st.container, label: c?.code ?? "—", sublabel: c?.company ?? "" });
    }
    return map;
  }, [stuffings.items, containers.items]);

  const rows = useMemo<ReportRow[]>(
    () =>
      bookings.items
        // Only bookings already stuffed into a container, made in the chosen dates.
        .filter((b) => {
          const day = localDay(b.date);
          return containerOf.has(b.id) && day && day >= from && day <= to;
        })
        .map((b) => {
          const rc = receivers.items.find((r) => r.name === b.receiver);
          const invoice = invoices.items.find((i) => i.bookingId === b.id);
          return {
            id: b.id,
            booking: b,
            day: localDay(b.date),
            receiver: {
              name: b.receiver,
              location: [rc?.location, rc?.country].filter(Boolean).join(", "),
              contact: rc?.whatsapp ?? "",
            },
            bundleMarks: bundleMarksFor(b.id),
            bundles: b.actualBundle || b.bundleCount || 0,
            partner: invoice?.deliveryPartner ?? "",
            invoiced: !!invoice,
            payable: invoice ? Number(invoice.deliveryCharge || 0) : 0,
            receivable: invoice ? Number(invoice.amount || 0) : 0,
          };
        })
        .sort((a, b) => (a.day === b.day ? a.booking.code.localeCompare(b.booking.code) : a.day.localeCompare(b.day))),
    [bookings.items, receivers.items, invoices.items, containerOf, bundleMarksFor, from, to]
  );

  const groups = useMemo<ReportGroup[]>(() => {
    const map = new Map<string, ReportGroup>();
    for (const r of rows) {
      const b = r.booking;
      let key: string;
      let label: string;
      let sublabel: string | undefined;
      if (groupBy === "container") {
        const c = containerOf.get(b.id)!;
        key = c.id;
        label = c.label;
        sublabel = c.sublabel;
      } else if (groupBy === "customer") {
        key = b.sender.toLowerCase() || "~unknown";
        label = b.sender || "—";
        sublabel = senders.items.find((s) => s.name === b.sender)?.location;
      } else if (groupBy === "partner") {
        // The partner is chosen on the invoice, so bookings not invoiced yet have none.
        key = r.partner.toLowerCase() || "~uninvoiced";
        label = r.partner || "Not invoiced yet";
      } else {
        const country = receivers.items.find((x) => x.name === b.receiver)?.country ?? "";
        key = country.toLowerCase() || "~unknown";
        label = country || "Country not set";
      }
      const g = map.get(key) ?? { key, label, sublabel, rows: [], bundles: 0, payable: 0, receivable: 0 };
      g.rows.push(r);
      g.bundles += r.bundles;
      g.payable += r.payable;
      g.receivable += r.receivable;
      map.set(key, g);
    }
    // Biggest groups first; "Country not set" / "Not invoiced yet" go last.
    return [...map.values()].sort((a, b) =>
      a.key.startsWith("~") ? 1 : b.key.startsWith("~") ? -1 : b.rows.length - a.rows.length || a.label.localeCompare(b.label)
    );
  }, [rows, groupBy, containerOf, senders.items, receivers.items]);

  const totalBundles = rows.reduce((n, r) => n + r.bundles, 0);
  const totalReceivable = rows.reduce((n, r) => n + r.receivable, 0);
  const rangeLabel = `${fmtDate(from)} – ${fmtDate(to)}`;

  /** One group's PDF: its bookings in the chosen dates. */
  const downloadGroupPdf = async (g: ReportGroup) => {
    if (downloading) return;
    setDownloading(g.key);
    try {
      const label = GROUP_LABELS[groupBy];
      const slug = g.label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
      await downloadTablePdf(`booking-report-${groupBy}-${slug}-${from}-to-${to}.pdf`, {
        title: `${label.toUpperCase()} WISE BOOKING REPORT`,
        info: [
          [label, [g.label, g.sublabel].filter(Boolean).join(" · ")],
          ["Period", rangeLabel],
          ["No. of Bookings", String(g.rows.length)],
          ["No. of Bundles", String(g.bundles)],
          ["Generated On", fmtDate(new Date().toISOString())],
        ],
        head: ["Sl No", "Booking ID", "Receiver Details", "Bundle Mark", "Bundle Count", "Delivery Partner", "Delivery Partner Payable Amount", "Total Receivable Amount"],
        body: g.rows.map((r, i) => [
          String(i + 1),
          r.booking.code,
          [r.receiver.name, r.receiver.location, r.receiver.contact].filter(Boolean).join(", ") || "-",
          r.bundleMarks || "-",
          String(r.bundles),
          r.partner || "-",
          r.invoiced ? money(r.payable) : "-",
          r.invoiced ? money(r.receivable) : "-",
        ]),
        foot: ["", "", "", "Total", String(g.bundles), "", money(g.payable), money(g.receivable)],
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't create the PDF.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="cc-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}>
            <Field
              field={{ key: "from", label: "From", type: "date" }}
              value={from}
              onChange={(_, v) => {
                if (!v) return;
                setFrom(v);
                if (v > to) setTo(v);
                setOpenKey(null);
              }}
            />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <Field
              field={{ key: "to", label: "To", type: "date" }}
              value={to}
              onChange={(_, v) => {
                if (!v) return;
                setTo(v);
                if (v < from) setFrom(v);
                setOpenKey(null);
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {TABS.map((t) => (
            <Button
              key={t.key}
              variant={groupBy === t.key ? "primary" : "default"}
              onClick={() => {
                setGroupBy(t.key);
                setOpenKey(null);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="cc-panel-desc" style={{ marginBottom: 8 }}>
        {rangeLabel}
      </div>
      <div className="cc-stat-grid cc-stat-grid--row" style={{ marginBottom: 16 }}>
        <StatCard label="Bookings" value={rows.length} />
        <StatCard label="Bundles" value={totalBundles} />
        <StatCard label="Receivable" value={money(totalReceivable)} />
      </div>

      {loading && bookings.items.length === 0 ? (
        <div className="cc-card">
          <SkeletonTable columns={4} />
        </div>
      ) : groups.length === 0 ? (
        <div className="cc-card">
          <div className="cc-empty">No bookings made in the selected dates have been stuffed yet.</div>
        </div>
      ) : (
        groups.map((g) => {
          const open = openKey === g.key;
          return (
            <div className="cc-card" key={g.key} style={{ marginBottom: 12 }}>
              <div
                role="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : g.key)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
              >
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cc-panel-title">{g.label}</div>
                  {g.sublabel && <div className="cc-panel-desc">{g.sublabel}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className="cc-badge" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
                    {g.rows.length} booking{g.rows.length === 1 ? "" : "s"}
                  </span>
                  <span className="cc-badge" style={{ background: "var(--accent-soft)", color: "var(--accent-dark)" }}>
                    {g.bundles} bundle{g.bundles === 1 ? "" : "s"}
                  </span>
                  <span className="cc-badge" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                    {money(g.receivable)}
                  </span>
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => downloadGroupPdf(g)} loading={downloading === g.key} aria-label={`Download ${g.label} PDF`}>
                    {downloading !== g.key && <Download size={14} />} PDF
                  </Button>
                </span>
              </div>
              {open && (
                <div className="cc-table-wrap" style={{ borderTop: "1px solid var(--border)" }}>
                  <table className="cc-table">
                    <thead>
                      <tr>
                        <th>Sl No</th>
                        <th>Booking ID</th>
                        <th>Receiver</th>
                        <th>Location</th>
                        <th>Contact</th>
                        <th>Bundle mark</th>
                        <th>Bundles</th>
                        <th>Delivery partner</th>
                        <th>Delivery partner payable</th>
                        <th>Total receivable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r, i) => (
                          <tr key={r.id}>
                            <td>{i + 1}</td>
                            <td>{r.booking.code}</td>
                            <td>{r.receiver.name || "—"}</td>
                            <td>{r.receiver.location || "Location not set"}</td>
                            <td>{r.receiver.contact || "No contact number"}</td>
                            <td>{r.bundleMarks || "—"}</td>
                            <td>{r.bundles}</td>
                            <td>{r.partner || "—"}</td>
                            <td>{r.invoiced ? money(r.payable) : "Not invoiced"}</td>
                            <td>{r.invoiced ? money(r.receivable) : "Not invoiced"}</td>
                          </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td colSpan={6}>Total</td>
                        <td>{g.bundles}</td>
                        <td></td>
                        <td>{money(g.payable)}</td>
                        <td>{money(g.receivable)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
