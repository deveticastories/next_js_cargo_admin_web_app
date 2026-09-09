"use client";

/**
 * Shared packing-list workspace behind both the "Ready to ship" and
 * "Repacking" screens. `mode` controls which bookings are eligible and
 * which action button appears at the bottom:
 *
 *   - "ready"  → bookings already marked Ready to Ship; "Save" persists the
 *                current items without downloading, "Download" persists and
 *                downloads the packing list for a bundle.
 *   - "repack" → bookings still needing repacking; lets you record the
 *                bundle count after repacking and move it to Ready to ship.
 *
 * The packing list itself is persisted through `/api/packing-lists`
 * (looked up by booking + bundle number, upserted on save) rather than
 * being part of the booking record.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Plus, Save, X } from "lucide-react";
import type { Booking, BundleLineItem } from "@/types";
import type { ApiCollection } from "@/utils/useApiCollection";
import { api, ApiError } from "@/utils/apiClient";
import { downloadText } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { SkeletonTable } from "@/components/ui/Skeleton";

/** One flattened row of the ready-to-ship "Saved packing lists" table below the editor. */
interface SavedItemRow extends BundleLineItem {
  id: string;
  bookingCode: string;
  bundleNumber: number;
}

const SAVED_ITEM_COLUMNS: { key: keyof SavedItemRow; label: string }[] = [
  { key: "bookingCode", label: "Booking ID" },
  { key: "bundleNumber", label: "Bundle" },
  { key: "product", label: "Product name" },
  { key: "qty", label: "Qty" },
  { key: "fabric", label: "Fabric" },
  { key: "netWeight", label: "Net wt (kg)" },
  { key: "grossWeight", label: "Gross wt (kg)" },
  { key: "description", label: "Description" },
];

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

// Net/gross weight are recorded during repacking. In ready-to-ship, only the
// default first row shows them (read-only, whatever repacking recorded) — a
// row added afterward via "Add item" is a plain product line, with no
// weight boxes at all.
const WEIGHT_FIELDS = new Set<keyof BundleLineItem>(["netWeight", "grossWeight"]);

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
  const [savedMessage, setSavedMessage] = useState("");
  const [savedRows, setSavedRows] = useState<SavedItemRow[]>([]);
  const [loadingSavedRows, setLoadingSavedRows] = useState(false);

  const booking = bookings.items.find((b) => b.id === bookingId);

  /** Every saved packing-list item across every Ready-to-ship booking, flattened into table rows. */
  const loadSavedRows = async () => {
    setLoadingSavedRows(true);
    try {
      const lists = await api.get<{ id: string; booking: string; bundleNumber: number; items: BundleLineItem[] }[]>(
        "/packing-lists"
      );
      const readyBookings = new Map(
        bookings.items.filter((b) => b.repackingStatus === "Ready to Ship").map((b) => [b.id, b])
      );
      const rows: SavedItemRow[] = [];
      for (const list of lists) {
        const forBooking = readyBookings.get(list.booking);
        if (!forBooking) continue;
        list.items.forEach((item, index) => {
          // Skip a still-blank default row — nothing's actually been recorded for it yet.
          if (!item.product && !item.qty && !item.fabric && !item.description) return;
          rows.push({ id: `${list.id}-${index}`, bookingCode: forBooking.code, bundleNumber: list.bundleNumber, ...item });
        });
      }
      setSavedRows(rows);
    } catch {
      setSavedRows([]);
    } finally {
      setLoadingSavedRows(false);
    }
  };

  useEffect(() => {
    if (mode !== "ready") return;
    // Deferred a tick so the fetch's setState calls land in their own microtask rather than
    // synchronously inside the effect body (same pattern as `useApiCollection`).
    // Depends on `bookings.items`, not just `mode`: on first mount `CargoDataProvider`'s own
    // bookings fetch is still in flight, so `bookings.items` is `[]` and every packing list
    // would get filtered out (see `loadSavedRows`) — this re-runs once it actually arrives,
    // instead of the table sitting empty until the next Save/Download.
    queueMicrotask(() => {
      loadSavedRows();
    });
    // `loadSavedRows` itself is intentionally left out — it's redefined every render (not
    // memoized), so including it here would refire this on every render instead of only
    // when `mode` or the bookings list actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bookings.items]);

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
    setSavedMessage("");
    const b = bookings.items.find((x) => x.id === id);
    setAfterCount(b ? String(b.bundleCount) : "");
    if (id) await loadLines(id, "1");
    else setLines([emptyLine()]);
  };
  const selectBundle = async (n: string) => {
    setBundle(n);
    setSavedMessage("");
    await loadLines(bookingId, n);
  };

  const updateLine = (index: number, key: keyof BundleLineItem, val: string) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, [key]: val } : l)));
    setSavedMessage("");
  };
  const addLine = () => {
    setLines([...lines, emptyLine()]);
    setSavedMessage("");
  };
  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
    setSavedMessage("");
  };

  const persistLines = () => api.post("/packing-lists", { bookingId, bundleNumber: Number(bundle), items: lines });

  /** The Ready to ship screen's explicit "Save" button — persists without downloading. */
  const saveItems = async () => {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await persistLines();
      setSavedMessage(`Saved ${lines.length} item${lines.length === 1 ? "" : "s"} for Bundle ${bundle}.`);
      await loadSavedRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the packing list.");
    } finally {
      setSaving(false);
    }
  };

  const downloadList = async () => {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await persistLines();
      const rows = lines
        .map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric} | Net ${l.netWeight}kg | Gross ${l.grossWeight}kg | ${l.description}`)
        .join("\n");
      downloadText(
        `${booking?.code ?? bookingId}-bundle-${bundle}-ready-to-ship.txt`,
        `Ready to ship list\nBooking: ${booking?.code}\nBundle: ${bundle}\n\n${rows}`
      );
      await loadSavedRows();
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
    <>
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

        {error && <div className="cc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {savedMessage && <div className="cc-alert-success" style={{ marginBottom: 12 }}>{savedMessage}</div>}

        {bookingId ? (
          loadingList ? (
            <SkeletonTable columns={LINE_COLUMNS.length + 1} rows={3} />
          ) : (
            <>
              <div className="cc-mini-label">Packing list</div>
              <div className="cc-line-item-row" style={{ fontSize: 11.5, color: "var(--text-soft)", fontWeight: 600 }}>
                {LINE_COLUMNS.map((c) => (
                  <span key={c.key}>{c.label}</span>
                ))}
                <span></span>
              </div>
              {lines.map((line, index) => {
                // The default first row is the one place ready-to-ship shows net/gross
                // weight (read-only, whatever repacking recorded). Every row added
                // afterward via "Add item" is a plain product line — no weight boxes.
                const isDefaultRow = index === 0;
                return (
                  <div className="cc-line-item-row" key={index}>
                    {LINE_COLUMNS.map((c) => {
                      const isWeightField = WEIGHT_FIELDS.has(c.key);
                      if (mode === "ready" && isWeightField && !isDefaultRow) {
                        return <input key={c.key} className="cc-line-input" value="" disabled aria-hidden style={{ visibility: "hidden" }} />;
                      }
                      const readOnly = mode === "ready" && isWeightField;
                      return (
                        <input
                          key={c.key}
                          className="cc-line-input"
                          value={line[c.key]}
                          onChange={(e) => updateLine(index, c.key, e.target.value)}
                          readOnly={readOnly}
                          title={readOnly ? "Recorded during repacking — not editable here." : undefined}
                        />
                      );
                    })}
                    <Button variant="ghost" onClick={() => removeLine(index)} aria-label="Remove line">
                      <X size={15} />
                    </Button>
                  </div>
                );
              })}
              <Button size="sm" onClick={addLine} style={{ marginBottom: 16 }}>
                <Plus size={14} /> Add item
              </Button>

              {mode === "ready" ? (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Button onClick={saveItems} loading={saving}>
                    {!saving && <Save size={15} />} {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="primary" onClick={downloadList} loading={saving}>
                    {!saving && <Download size={15} />} {saving ? "Saving…" : "Download ready-to-ship list"}
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
                    <Button variant="primary" onClick={completeRepacking} loading={saving}>
                      {!saving && <CheckCircle2 size={15} />} {saving ? "Saving…" : "Complete repacking, move to ready to ship"}
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

      {mode === "ready" && (
        <div className="cc-card" style={{ padding: 18, marginTop: 16 }}>
          <div className="cc-panel-title" style={{ marginBottom: 4 }}>
            Saved packing lists
          </div>
          <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
            Every item saved so far, across every Ready-to-ship booking.
          </div>
          {loadingSavedRows ? (
            <SkeletonTable columns={SAVED_ITEM_COLUMNS.length} rows={4} />
          ) : (
            <DataTable columns={SAVED_ITEM_COLUMNS} rows={savedRows} emptyText="Nothing saved yet — save or download a packing list above." />
          )}
        </div>
      )}
    </>
  );
}
