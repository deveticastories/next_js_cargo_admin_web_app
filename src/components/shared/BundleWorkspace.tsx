"use client";

/**
 * Shared packing-list workspace behind both the "Ready to ship" and
 * "Repacking" screens. `mode` controls which bookings are eligible and
 * which action button appears at the bottom:
 *
 *   - "ready"  → bookings already marked Ready to Ship; "Save" persists the
 *                current bundle's items (repeat per bundle — pick a bundle,
 *                add items, Save, pick the next bundle, ...). The "Added
 *                items" table tracks just the selected booking's saved
 *                bundles (cleared when you switch booking); "Download
 *                ready-to-ship list", next to it, pulls every saved bundle
 *                for that booking and downloads them together as one file.
 *                "Saved packing lists" further below is unrelated to the
 *                current selection — it's every item saved across every
 *                Ready-to-ship booking.
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

/** One flattened row of a ready-to-ship packing-list table (both "Added items" and "Saved packing lists"). */
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

// Net/gross weight are recorded during repacking and carried into
// ready-to-ship as a starting point, but editable there too. In ready-to-ship,
// only the default first row shows them — a row added afterward via
// "Add item" is a plain product line, with no weight boxes at all.
const WEIGHT_FIELDS = new Set<keyof BundleLineItem>(["netWeight", "grossWeight"]);
const WEIGHT_COLUMNS = LINE_COLUMNS.filter((c) => WEIGHT_FIELDS.has(c.key));
const PRODUCT_COLUMNS = LINE_COLUMNS.filter((c) => !WEIGHT_FIELDS.has(c.key));

export interface BundleWorkspaceProps {
  mode: "ready" | "repack";
  bookings: ApiCollection<Booking>;
}

export function BundleWorkspace({ mode, bookings }: BundleWorkspaceProps) {
  // The Booking ID dropdown's options — repack mode also excludes bookings already
  // repacked (Confirm has set `actualBundle` at least once). "Complete repacking, move
  // to ready to ship" is currently commented out, so `repackingStatus` alone never flips
  // to "Ready to Ship" from this screen and can't be relied on by itself to tell "still
  // needs repacking" from "already repacked".
  const eligible = bookings.items.filter((b) =>
    mode === "ready" ? b.repackingStatus === "Ready to Ship" : b.repackingStatus === "Repacking Required" && !b.actualBundle
  );
  // "Saved bundle list" / "Saved packing lists" scope — deliberately broader than
  // `eligible` above: it must still show a booking's saved bundles after that booking
  // becomes "already repacked" and drops out of the dropdown, not just before.
  const savedListBookings = bookings.items.filter((b) =>
    b.repackingStatus === (mode === "ready" ? "Ready to Ship" : "Repacking Required")
  );
  const [bookingId, setBookingId] = useState("");
  const [bundle, setBundle] = useState("1");
  // Repack mode only: the bundle number typed into "Actual bundle" before
  // "Create Bundle" is clicked to make it the active one.
  const [bundleInput, setBundleInput] = useState("1");
  // Repack mode only: bundles "Save" has added to the "Added bundles" list for
  // review, but hasn't yet written to the database — "Confirm" there is what
  // actually persists them (see `confirmBundles`).
  const [stagedBundles, setStagedBundles] = useState<{ bundleNumber: number; items: BundleLineItem[] }[]>([]);
  // Repack mode only: whether the Packing list fields are showing. Save hides
  // them (that bundle is done); Create Bundle shows them again, blank, for
  // the next one — so there's never a stray empty form sitting open.
  const [packingListVisible, setPackingListVisible] = useState(true);
  const [lines, setLines] = useState<BundleLineItem[]>([emptyLine()]);
  const [afterCount, setAfterCount] = useState("");
  const [repackedBy, setRepackedBy] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [savedRows, setSavedRows] = useState<SavedItemRow[]>([]);
  const [loadingSavedRows, setLoadingSavedRows] = useState(false);
  const [addedItems, setAddedItems] = useState<SavedItemRow[]>([]);
  const [loadingAddedItems, setLoadingAddedItems] = useState(false);

  const booking = bookings.items.find((b) => b.id === bookingId);

  /**
   * Every saved packing-list item across every booking eligible for the
   * current mode, flattened into table rows — the actual "get all saved
   * bundles" call (no bookingId filter), feeding "Saved bundle list" (repack)
   * / "Saved packing lists" (ready).
   */
  const loadSavedRows = async () => {
    setLoadingSavedRows(true);
    try {
      const lists = await api.get<{ id: string; booking: string; bundleNumber: number; items: BundleLineItem[] }[]>(
        "/packing-lists"
      );
      const scopedBookings = new Map(savedListBookings.map((b) => [b.id, b]));
      const rows: SavedItemRow[] = [];
      for (const list of lists) {
        const forBooking = scopedBookings.get(list.booking);
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

  /**
   * Every saved (database-confirmed) packing-list item for one booking,
   * across all of its saved bundles, flattened into table rows — scoped to
   * whichever booking is currently selected. Feeds "Saved bundle list"
   * (repack) / "Added items" (ready), not "Added bundles" (repack's own
   * this-session staging table) or "Saved packing lists" (a global view
   * across every Ready-to-ship booking).
   */
  const loadAddedItems = async (id: string) => {
    if (!id) {
      setAddedItems([]);
      return;
    }
    setLoadingAddedItems(true);
    try {
      const lists = await api.get<{ bundleNumber: number; items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${id}`);
      const code = bookings.items.find((b) => b.id === id)?.code ?? id;
      const rows: SavedItemRow[] = [];
      lists
        .slice()
        .sort((a, b) => a.bundleNumber - b.bundleNumber)
        .forEach((list) => {
          list.items.forEach((item, index) => {
            // Skip a still-blank default row — nothing's actually been recorded for it yet.
            if (!item.product && !item.qty && !item.fabric && !item.description) return;
            rows.push({ id: `${id}-${list.bundleNumber}-${index}`, bookingCode: code, bundleNumber: list.bundleNumber, ...item });
          });
        });
      setAddedItems(rows);
    } catch {
      setAddedItems([]);
    } finally {
      setLoadingAddedItems(false);
    }
  };

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
    setError("");
    setSavedMessage("");
    // Clear the Added items table right away — it reloads scoped to the newly
    // selected booking below, instead of lingering with the previous booking's rows.
    setAddedItems([]);
    // Unconfirmed bundles are scoped to whichever booking was open — starting fresh
    // matches "Added bundles" starting out empty for a newly selected booking.
    setStagedBundles([]);
    // The first bundle is shown right away, same as always — only a Save (not
    // selecting a booking) hides the Packing list fields.
    setPackingListVisible(true);
    const b = bookings.items.find((x) => x.id === id);
    // "Actual bundle" (repack mode) starts out at the bundle count entered when the
    // booking was made, instead of always "1". "Bundle count" always starts at "1"
    // regardless, and is independently editable from there.
    const initialBundle = b ? String(b.bundleCount || 1) : "1";
    setBundle(initialBundle);
    setBundleInput(initialBundle);
    setAfterCount("1");
    // Packing list starts empty on selecting a booking, even if that bundle number
    // already has saved items — "Create Bundle" is what loads an existing bundle's list.
    setLines([emptyLine()]);
    // "Added bundles" itself stays a this-session staging area (starts empty,
    // above). "Added items" (ready mode only) is scoped to this booking; repack's
    // "Saved bundle list" is the global `loadSavedRows` view instead, unaffected here.
    if (id && mode === "ready") {
      await loadAddedItems(id);
    }
  };
  const selectBundle = async (n: string) => {
    setBundle(n);
    setSavedMessage("");
    await loadLines(bookingId, n);
  };

  /**
   * Repack mode's "Create Bundle" button — makes the typed bundle number the
   * active one and bumps "Bundle count" by 1 (it starts at 1 for the bundle
   * already active from selecting the booking, so the first Create Bundle
   * click takes it to 2, the next to 3, and so on).
   */
  const createBundle = async () => {
    if (!bookingId || !bundleInput) return;
    await selectBundle(bundleInput);
    setAfterCount((prev) => String(Number(prev || 0) + 1));
    setPackingListVisible(true);
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

  /** Writes each given bundle to the database (used by both "Confirm" and "Complete repacking"). */
  const persistStagedBundles = async (bundlesToSave: { bundleNumber: number; items: BundleLineItem[] }[]) => {
    for (const b of bundlesToSave) {
      await api.post("/packing-lists", { bookingId, bundleNumber: b.bundleNumber, items: b.items });
    }
  };

  /**
   * The "Save" button. In ready mode it persists the active bundle's packing
   * list directly, same as always. In repack mode it does NOT write to the
   * database — it only adds/updates the active bundle in "Added bundles"
   * below (for review) and clears the Packing list fields for the next one.
   * "Confirm" in that panel is what actually saves repack bundles.
   */
  const saveItems = async () => {
    if (mode === "repack") {
      const bundleNumber = Number(bundle);
      setStagedBundles((prev) =>
        [...prev.filter((b) => b.bundleNumber !== bundleNumber), { bundleNumber, items: lines }].sort(
          (a, b) => a.bundleNumber - b.bundleNumber
        )
      );
      setError("");
      setSavedMessage(`Added Bundle ${bundle} to the list below — click Confirm to save it.`);
      setLines([emptyLine()]);
      // Hide the Packing list fields — that bundle is done. "Create Bundle"
      // (below) brings them back, blank, for the next one.
      setPackingListVisible(false);
      // Advance both the active bundle and "Actual bundle" to the next number.
      // Bug this fixes: only `bundleInput` (the visible field) used to advance,
      // while `bundle` (what Save actually tags the staged entry with) stayed
      // put — so filling the blank form and clicking Save again, without an
      // explicit Create Bundle click, silently overwrote the same bundle
      // instead of creating the next one, even though the field showed the
      // next number.
      const nextBundle = String(bundleNumber + 1);
      setBundle(nextBundle);
      setBundleInput(nextBundle);
      return;
    }
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await persistLines();
      setSavedMessage(`Saved ${lines.length} item${lines.length === 1 ? "" : "s"} for Bundle ${bundle}.`);
      await Promise.all([loadSavedRows(), loadAddedItems(bookingId)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the packing list.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * "Added bundles" panel's "Confirm" button (repack mode) — writes every
   * staged bundle's packing list to the database, updates the booking's own
   * `bundleCount` and `actualBundle` to match however many the user actually
   * created (not whatever "Bundle count" happens to say) — `actualBundle` is
   * what the Bookings table shows, `bundleCount` is also kept in sync since
   * Ready to ship's own bundle picker still reads it — then refreshes "Saved
   * bundle list" below from the server so the just-confirmed bundles show up.
   */
  const confirmBundles = async () => {
    if (!bookingId || stagedBundles.length === 0) return;
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const confirmedCount = stagedBundles.length;
      await persistStagedBundles(stagedBundles);
      await bookings.update(bookingId, { bundleCount: confirmedCount, actualBundle: confirmedCount });
      setAfterCount(String(confirmedCount));
      setSavedMessage(`Confirmed and saved ${confirmedCount} bundle${confirmedCount === 1 ? "" : "s"}.`);
      // "Added bundles" is a staging area, not a saved-history view — it empties
      // out once confirmed, same as it started empty for this booking.
      setStagedBundles([]);
      await loadSavedRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the bundles.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * The Added items panel's "Download ready-to-ship list" button — persists
   * whatever's currently open (in case the last bundle wasn't explicitly
   * saved yet), then pulls every saved bundle for the selected booking and
   * downloads them together, grouped by bundle.
   */
  const downloadAllBundles = async () => {
    if (!bookingId) return;
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await persistLines();
      const lists = await api.get<{ bundleNumber: number; items: BundleLineItem[] }[]>(`/packing-lists?bookingId=${bookingId}`);
      const sections = lists
        .slice()
        .sort((a, b) => a.bundleNumber - b.bundleNumber)
        .map((list) => {
          const rows = list.items
            .filter((l) => l.product || l.qty || l.fabric || l.description)
            .map((l) => `${l.product} | Qty ${l.qty} | ${l.fabric} | Net ${l.netWeight}kg | Gross ${l.grossWeight}kg | ${l.description}`)
            .join("\n");
          return `Bundle ${list.bundleNumber}\n${rows || "(no items)"}`;
        });
      downloadText(
        `${booking?.code ?? bookingId}-ready-to-ship.txt`,
        `Ready to ship list\nBooking: ${booking?.code}\n\n${sections.join("\n\n")}`
      );
      await Promise.all([loadSavedRows(), loadAddedItems(bookingId)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download the ready-to-ship list.");
    } finally {
      setSaving(false);
    }
  };

  // Its button is commented out below (per request) — kept here for when it comes back.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const completeRepacking = async () => {
    if (!afterCount || !repackedBy) {
      alert("Enter the bundle count after repacking and who repacked it.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Persist every staged bundle plus whatever's currently open (in case it
      // wasn't explicitly saved yet) — Complete repacking shouldn't leave any
      // reviewed-but-unconfirmed bundle behind.
      const bundleNumber = Number(bundle);
      await persistStagedBundles([
        ...stagedBundles.filter((b) => b.bundleNumber !== bundleNumber),
        { bundleNumber, items: lines },
      ]);
      setStagedBundles([]);
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

  /**
   * Repack mode's "Added bundles" rows — a this-session staging area only, not
   * a saved-history view: purely what's in `stagedBundles`, nothing fetched
   * server-side. Starts empty for a newly selected booking and empties again
   * once Confirm writes it to the database.
   */
  const stagedRows: SavedItemRow[] = stagedBundles
    .flatMap((b) =>
      b.items
        .filter((item) => item.product || item.qty || item.fabric || item.description)
        .map((item, index) => ({
          id: `staged-${b.bundleNumber}-${index}`,
          bookingCode: booking?.code ?? bookingId,
          bundleNumber: b.bundleNumber,
          ...item,
        }))
    )
    .sort((a, b) => a.bundleNumber - b.bundleNumber);

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
          {mode === "repack" ? (
            <div className="cc-field">
              <label>Actual bundle</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  value={bundleInput}
                  onChange={(e) => setBundleInput(e.target.value)}
                  placeholder="Enter bundle number"
                  style={{ flex: 1 }}
                />
                <Button size="sm" onClick={createBundle} disabled={!bookingId || !bundleInput}>
                  <Plus size={14} /> Create Bundle
                </Button>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        {error && <div className="cc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {savedMessage && <div className="cc-alert-success" style={{ marginBottom: 12 }}>{savedMessage}</div>}

        {bookingId ? (
          loadingList ? (
            <SkeletonTable columns={LINE_COLUMNS.length + 1} rows={3} />
          ) : (
            <>
              {mode === "ready" || packingListVisible ? (
                <>
                  <div className="cc-mini-label">Packing list</div>
                  {/* Same layout in both modes: net/gross weight on top (default first row
                      only) and the product fields below. The product columns get one shared
                      header, with "Add item" sitting on its right instead of a full-width button. */}
                  <div className="cc-line-item-products-head">
                    <Button size="sm" onClick={addLine}>
                      <Plus size={14} /> Add item
                    </Button>
                  </div>
                  {lines.map((line, index) => {
                    const isDefaultRow = index === 0;
                    return (
                      <div className="cc-line-item-card" key={index}>
                        {isDefaultRow && (
                          <div className="cc-line-item-weights">
                            {WEIGHT_COLUMNS.map((c) => (
                              <div className="cc-line-field" key={c.key}>
                                <label>{c.label}</label>
                                <input
                                  className="cc-line-input"
                                  value={line[c.key]}
                                  onChange={(e) => updateLine(index, c.key, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="cc-line-item-products">
                          {PRODUCT_COLUMNS.map((c) => (
                            <div className="cc-line-field" key={c.key}>
                              <label>{c.label}</label>
                              <input
                                className="cc-line-input"
                                value={line[c.key]}
                                onChange={(e) => updateLine(index, c.key, e.target.value)}
                              />
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            className="cc-line-remove"
                            onClick={() => removeLine(index)}
                            aria-label="Remove line"
                          >
                            <X size={15} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button onClick={saveItems} loading={saving}>
                      {!saving && <Save size={15} />} {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </>
              ) : (
                // Repack mode, right after a Save — that bundle's fields are done with,
                // so they stay out of the way until Create Bundle brings them back blank.
                <div className="cc-empty">Bundle {bundle} saved to the list below. Click Create Bundle above to start the next one.</div>
              )}

              {mode === "repack" && (
                <>
                  <div className="cc-grid-2" style={{ marginTop: 12 }}>
                    <Field
                      field={{ key: "afterCount", label: "Bundle count", type: "number", disabled: true }}
                      value={afterCount}
                      onChange={(_, v) => setAfterCount(v)}
                    />
                    <Field field={{ key: "repackedBy", label: "Repacked by" }} value={repackedBy} onChange={(_, v) => setRepackedBy(v)} />
                  </div>
                  {/* Commented out per request — button hidden, `completeRepacking` kept for when it comes back.
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" onClick={completeRepacking} loading={saving}>
                      {!saving && <CheckCircle2 size={15} />} {saving ? "Saving…" : "Complete repacking, move to ready to ship"}
                    </Button>
                  </div>
                  */}
                </>
              )}
            </>
          )
        ) : (
          <div className="cc-empty">Choose a booking above to build its packing list.</div>
        )}
      </div>

      <div className="cc-card" style={{ padding: 18, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <div className="cc-panel-title" style={{ marginBottom: 4 }}>
              {mode === "repack" ? "Added bundles" : "Added items"}
            </div>
            <div className="cc-panel-desc">
              {mode === "repack"
                ? "For your review — Save above adds a bundle here, but nothing reaches the database until you click Confirm."
                : "Items saved for the selected booking, across its bundles — pick a bundle, save, pick the next, and it builds up here."}
            </div>
          </div>
          {mode === "ready" ? (
            <Button
              variant="primary"
              onClick={downloadAllBundles}
              loading={saving}
              disabled={!bookingId}
              title={!bookingId ? "Choose a booking above first" : "Download every saved bundle for this booking"}
            >
              {!saving && <Download size={15} />} {saving ? "Saving…" : "Download ready-to-ship list"}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={confirmBundles}
              loading={saving}
              disabled={!bookingId || stagedBundles.length === 0}
              title={stagedBundles.length === 0 ? "Save a bundle above first" : "Save every listed bundle to the database"}
            >
              {!saving && <CheckCircle2 size={15} />} {saving ? "Saving…" : "Confirm"}
            </Button>
          )}
        </div>
        {mode === "repack" ? (
          // Local staging data — no fetch involved, so no loading skeleton needed.
          <DataTable
            columns={SAVED_ITEM_COLUMNS}
            rows={stagedRows}
            emptyText={bookingId ? "Nothing added yet — save a bundle above." : "Choose a booking above to see its added items here."}
          />
        ) : loadingAddedItems ? (
          <SkeletonTable columns={SAVED_ITEM_COLUMNS.length} rows={4} />
        ) : (
          <DataTable
            columns={SAVED_ITEM_COLUMNS}
            rows={addedItems}
            emptyText={bookingId ? "Nothing saved yet — save a packing list above." : "Choose a booking above to see its added items here."}
          />
        )}
      </div>

      <div className="cc-card" style={{ padding: 18, marginTop: 16 }}>
        <div className="cc-panel-title" style={{ marginBottom: 4 }}>
          {mode === "repack" ? "Saved bundle list" : "Saved packing lists"}
        </div>
        <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
          Every bundle actually saved to the database so far, across every {mode === "repack" ? "Repacking-required" : "Ready-to-ship"} booking
          — fetched fresh from the server, not just this session&apos;s view.
        </div>
        {loadingSavedRows ? (
          <SkeletonTable columns={SAVED_ITEM_COLUMNS.length} rows={4} />
        ) : (
          <DataTable
            columns={SAVED_ITEM_COLUMNS}
            rows={savedRows}
            emptyText={mode === "repack" ? "Nothing confirmed yet — click Confirm above." : "Nothing saved yet — save or download a packing list above."}
          />
        )}
      </div>
    </>
  );
}
