"use client";

/**
 * Shared packing-list workspace behind both the "Ready to ship" and
 * "Repacking" screens. `mode` controls which bookings are eligible and
 * which action button appears at the bottom:
 *
 *   - "ready"  → bookings already marked Ready to Ship; lets you download
 *                the packing list for a bundle.
 *   - "repack" → bookings still needing repacking; lets you record the
 *                bundle count after repacking and move it to Ready to ship.
 *
 * The packing list itself is persisted through `/api/packing-lists`
 * (looked up by booking + bundle number, upserted on save) rather than
 * being part of the booking record.
 */

import { useState } from "react";
import { CheckCircle2, Download, Plus, X } from "lucide-react";
import type { Booking, BundleLineItem } from "@/types";
import type { ApiCollection } from "@/utils/useApiCollection";
import { api, ApiError } from "@/utils/apiClient";
import { downloadText } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

function emptyLine(): BundleLineItem {
  return { netWeight: "", grossWeight: "", product: "", qty: "", fabric: "", description: "" };
}

const LINE_COLUMNS: { key: keyof BundleLineItem; label: string }[] = [
  { key: "netWeight", label: "Net wt (kg)" },
  { key: "grossWeight", label: "Gross wt (kg)" },
  { key: "product", label: "Product name" },
  { key: "qty", label: "Qty" },
  { key: "fabric", label: "Fabric" },
  { key: "description", label: "Description" },
];

export interface BundleWorkspaceProps {
  mode: "ready" | "repack";
  bookings: ApiCollection<Booking>;
}

export function BundleWorkspace({ mode, bookings }: BundleWorkspaceProps) {
  const eligible = bookings.items.filter(
    (b) => b.repackingStatus === (mode === "ready" ? "Ready to Ship" : "Repacking Required")
  );
  const [bookingId, setBookingId] = useState("");
  const [bundle, setBundle] = useState("1");
  const [lines, setLines] = useState<BundleLineItem[]>([emptyLine()]);
  const [afterCount, setAfterCount] = useState("");
  const [repackedBy, setRepackedBy] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const booking = bookings.items.find((b) => b.id === bookingId);

  const loadLines = async (id: string, bundleNo: string) => {
    setLoadingList(true);
    try {
      const lists = await api.get<{ bundleNumber: number; items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${id}`);
      const match = lists.find((l) => l.bundleNumber === Number(bundleNo));
      setLines(match?.items.length ? match.items : [emptyLine()]);
    } catch {
      setLines([emptyLine()]);
    } finally {
      setLoadingList(false);
    }
  };

  const selectBooking = async (id: string) => {
    setBookingId(id);
    setBundle("1");
    setError("");
    const b = bookings.items.find((x) => x.id === id);
    setAfterCount(b ? String(b.bundleCount) : "");
    if (id) await loadLines(id, "1");
    else setLines([emptyLine()]);
  };
  const selectBundle = async (n: string) => {
    setBundle(n);
    await loadLines(bookingId, n);
  };

  const updateLine = (index: number, key: keyof BundleLineItem, val: string) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [key]: val } : l)));
  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));

  const persistLines = () => api.post("/packing-lists", { bookingId, bundleNumber: Number(bundle), items: lines });

  const downloadList = async () => {
    setSaving(true);
    setError("");
    try {
      await persistLines();
      const rows = lines
        .map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric} | Net ${l.netWeight}kg | Gross ${l.grossWeight}kg | ${l.description}`)
        .join("\n");
      downloadText(
        `${booking?.code ?? bookingId}-bundle-${bundle}-ready-to-ship.txt`,
        `Ready to ship list\nBooking: ${booking?.code}\nBundle: ${bundle}\n\n${rows}`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the packing list.");
    } finally {
      setSaving(false);
    }
  };

  const completeRepacking = async () => {
    if (!afterCount || !repackedBy) {
      alert("Enter the bundle count after repacking and who repacked it.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistLines();
      await bookings.update(bookingId, { repackingStatus: "Ready to Ship", bundleCount: Number(afterCount) });
      setBookingId("");
      setBundle("1");
      setLines([emptyLine()]);
      setAfterCount("");
      setRepackedBy("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete repacking.");
    } finally {
      setSaving(false);
    }
  };

  const bundleCountOf = booking ? Number(booking.bundleCount || 1) : 0;
  const bundleOptions = Array.from({ length: bundleCountOf || 1 }, (_, i) => String(i + 1));

  return (
    <div className="cc-card" style={{ padding: 18 }}>
      <div className="cc-grid-2" style={{ marginBottom: 16 }}>
        <div className="cc-field">
          <label>Booking ID</label>
          <select value={bookingId} onChange={(e) => selectBooking(e.target.value)}>
            <option value="">Choose a booking</option>
            {eligible.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.sender} → {b.receiver}
              </option>
            ))}
          </select>
        </div>
        <div className="cc-field">
          <label>Bundle</label>
          <select value={bundle} onChange={(e) => selectBundle(e.target.value)} disabled={!bookingId}>
            {bundleOptions.map((n) => (
              <option key={n} value={n}>
                Bundle {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="cc-error" style={{ marginBottom: 12 }}>{error}</div>}

      {bookingId ? (
        loadingList ? (
          <div className="cc-empty">Loading packing list…</div>
        ) : (
          <>
            <div className="cc-mini-label">Packing list</div>
            <div className="cc-line-item-row" style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>
              {LINE_COLUMNS.map((c) => (
                <span key={c.key}>{c.label}</span>
              ))}
              <span></span>
            </div>
            {lines.map((line, index) => (
              <div className="cc-line-item-row" key={index}>
                {LINE_COLUMNS.map((c) => (
                  <input
                    key={c.key}
                    className="cc-line-input"
                    value={line[c.key]}
                    onChange={(e) => updateLine(index, c.key, e.target.value)}
                  />
                ))}
                <Button variant="ghost" onClick={() => removeLine(index)} aria-label="Remove line">
                  <X size={15} />
                </Button>
              </div>
            ))}
            <Button size="sm" onClick={addLine} style={{ marginBottom: 16 }}>
              <Plus size={14} /> Add item
            </Button>

            {mode === "ready" ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button variant="primary" onClick={downloadList} disabled={saving}>
                  <Download size={15} /> {saving ? "Saving…" : "Download ready-to-ship list"}
                </Button>
              </div>
            ) : (
              <>
                <div className="cc-grid-2" style={{ marginTop: 6 }}>
                  <Field
                    field={{ key: "afterCount", label: "Bundle count after repacking", type: "number" }}
                    value={afterCount}
                    onChange={(_, v) => setAfterCount(v)}
                  />
                  <Field field={{ key: "repackedBy", label: "Repacked by" }} value={repackedBy} onChange={(_, v) => setRepackedBy(v)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="primary" onClick={completeRepacking} disabled={saving}>
                    <CheckCircle2 size={15} /> {saving ? "Saving…" : "Complete repacking, move to ready to ship"}
                  </Button>
                </div>
              </>
            )}
          </>
        )
      ) : (
        <div className="cc-empty">Choose a booking above to build its packing list.</div>
      )}
    </div>
  );
}
