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
import { fmtDate } from "@/utils/format";
import { downloadPackingListPdf } from "@/utils/pdf";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { colors } from "@/utils/colors";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { SkeletonTable } from "@/components/ui/Skeleton";

/** One flattened row of a ready-to-ship packing-list table (both "Added items" and "Saved packing lists"). */
interface SavedItemRow extends BundleLineItem {
  id: string;
  bookingCode: string;
  bundleNumber: number;
  /** Repacking tables only. */
  repackedBy?: string;
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

/** Repacking's tables add a "Repacked by" column after the shared ones. */
const REPACK_ITEM_COLUMNS: { key: keyof SavedItemRow; label: string }[] = [
  ...SAVED_ITEM_COLUMNS,
  { key: "repackedBy", label: "Repacked by" },
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
// Input filtering per field: weights and quantity take whole numbers only; the text fields
// take letters (any language) and spaces plus a few punctuation marks — no digits.
const INTEGER_FIELDS = new Set<keyof BundleLineItem>(["netWeight", "grossWeight", "qty"]);
const sanitizeLineValue = (key: keyof BundleLineItem, val: string) =>
  INTEGER_FIELDS.has(key) ? val.replace(/\D/g, "") : val.replace(/[^\p{L}\p{M} .,\-'&/()]/gu, "");

const WEIGHT_FIELDS = new Set<keyof BundleLineItem>(["netWeight", "grossWeight"]);
const WEIGHT_COLUMNS = LINE_COLUMNS.filter((c) => WEIGHT_FIELDS.has(c.key));
const PRODUCT_COLUMNS = LINE_COLUMNS.filter((c) => !WEIGHT_FIELDS.has(c.key));

export interface BundleWorkspaceProps {
  mode: "ready" | "repack";
  bookings: ApiCollection<Booking>;
}

export function BundleWorkspace({ mode, bookings }: BundleWorkspaceProps) {
  const { senders, receivers } = useCargoData();
  // The Booking ID dropdown's options — repack mode also excludes bookings already
  // repacked (Confirm has set `actualBundle` at least once). "Complete repacking, move
  // to ready to ship" is currently commented out, so `repackingStatus` alone never flips
  // to "Ready to Ship" from this screen and can't be relied on by itself to tell "still
  // needs repacking" from "already repacked".
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
  // Repack mode only: whether the Packing list fields are showing. Hidden
  // until Create Bundle is clicked (selecting a booking alone no longer
  // reveals it), and hidden again after Save (that bundle is done); Create
  // Bundle shows it again, blank, for the next one — so there's never a
  // stray empty form sitting open. Also doubles as the Create Bundle
  // button's own disabled state — it stays disabled while a bundle's
  // packing list is open, re-enabling only once Save closes it.
  const [packingListVisible, setPackingListVisible] = useState(true);
  const [lines, setLines] = useState<BundleLineItem[]>([emptyLine()]);
  const [afterCount, setAfterCount] = useState("");
  const [repackedBy, setRepackedBy] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  // Bundle numbers (per booking code) saved from the Ready to ship screen — what the Bundle dropdown locks.
  const [readySavedBundles, setReadySavedBundles] = useState<Map<string, Set<number>>>(new Map());
  const [savedRows, setSavedRows] = useState<SavedItemRow[]>([]);
  const [loadingSavedRows, setLoadingSavedRows] = useState(false);
  // Ready mode's "Added items" table: this-session only, never written to the database on its own —
  // each Save appends that bundle's items here, and it feeds the ready-to-ship download.
  const [addedItems, setAddedItems] = useState<SavedItemRow[]>([]);

  const booking = bookings.items.find((b) => b.id === bookingId);

  // Ready mode also drops a booking once every one of its bundles has a saved packing list
  // (`savedRows` below) — it's done, so it shouldn't be offered again. The currently selected
  // booking is kept so the dropdown doesn't blank out right after its last bundle is saved.
  const savedBundlesByCode = new Map<string, Set<number>>();
  for (const r of savedRows) {
    if (!savedBundlesByCode.has(r.bookingCode)) savedBundlesByCode.set(r.bookingCode, new Set());
    savedBundlesByCode.get(r.bookingCode)!.add(r.bundleNumber);
  }
  const eligible = bookings.items.filter((b) =>
    mode === "ready"
      ? b.repackingStatus === "Ready to Ship" &&
        (b.id === bookingId || (savedBundlesByCode.get(b.code)?.size ?? 0) < Math.max(1, b.actualBundle || b.bundleCount || 1))
      : b.repackingStatus === "Repacking Required" && !b.actualBundle
  );

  /**
   * Every saved packing-list item across every booking eligible for the
   * current mode, flattened into table rows — the actual "get all saved
   * bundles" call (no bookingId filter), feeding "Saved bundle list" (repack)
   * / "Saved packing lists" (ready).
   */
  const loadSavedRows = async () => {
    setLoadingSavedRows(true);
    try {
      const lists = await api.get<{ id: string; booking: string; bundleNumber: number; items: BundleLineItem[]; repackedBy?: string; readySaved?: boolean }[]>(
        "/packing-lists"
      );
      const scopedBookings = new Map(savedListBookings.map((b) => [b.id, b]));
      const rows: SavedItemRow[] = [];
      const readySaved = new Map<string, Set<number>>();
      for (const list of lists) {
        const forBooking = scopedBookings.get(list.booking);
        if (!forBooking) continue;
        if (list.readySaved) {
          if (!readySaved.has(forBooking.code)) readySaved.set(forBooking.code, new Set());
          readySaved.get(forBooking.code)!.add(list.bundleNumber);
        }
        list.items.forEach((item, index) => {
          // Skip a still-blank default row — nothing's actually been recorded for it yet.
          if (!item.product && !item.qty && !item.fabric && !item.description) return;
          rows.push({ id: `${list.id}-${index}`, bookingCode: forBooking.code, bundleNumber: list.bundleNumber, repackedBy: list.repackedBy ?? "", ...item });
        });
      }
      setSavedRows(rows);
      setReadySavedBundles(readySaved);
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
    setRepackedBy("");
    // Repack mode: the Packing list fields stay hidden until Create Bundle is
    // clicked. Ready mode ignores this flag (its list always renders), so
    // leaving it true there changes nothing.
    setPackingListVisible(mode !== "repack");
    const b = bookings.items.find((x) => x.id === id);
    // "Actual bundle" (repack mode) starts out at the bundle count entered when the
    // booking was made, instead of always "1".
    const initialBundle = b ? String(b.bundleCount || 1) : "1";
    setBundle(initialBundle);
    setBundleInput(initialBundle);
    // "Bundle count" starts at 0 — no bundle has actually been created yet (the
    // packing list itself is still hidden until Create Bundle is clicked). Each
    // Create Bundle click below bumps it by 1, so it reads 1 after the first
    // click, 2 after the second, and so on.
    setAfterCount("0");
    // Packing list starts empty on selecting a booking, even if that bundle number
    // already has saved items — "Create Bundle" is what loads an existing bundle's list.
    setLines([emptyLine()]);
    // "Added items" (ready mode) is this-session and scoped to the selected booking — start it fresh.
    setAddedItems([]);
  };
  const selectBundle = async (n: string) => {
    // Ready mode hides the Packing list after Save — picking a bundle brings it back.
    setPackingListVisible(true);
    setBundle(n);
    setSavedMessage("");
    // Ready mode always opens a bundle blank — never pre-filled from a previously saved
    // list (e.g. the one Repacking recorded). Repack mode's Create Bundle loads it.
    if (mode === "ready") {
      setLines([emptyLine()]);
      return;
    }
    await loadLines(bookingId, n);
  };

  /**
   * Repack mode's "Create Bundle" button — makes the typed bundle number the
   * active one and bumps "Bundle count" by 1 ("Bundle count" starts at 0 on
   * selecting a booking, so the first Create Bundle click takes it to 1, the
   * next to 2, and so on).
   */
  const createBundle = async () => {
    if (!bookingId || !bundle) return;
    await selectBundle(bundle);
    setAfterCount((prev) => String(Number(prev || 0) + 1));
    setPackingListVisible(true);
  };

  const updateLine = (index: number, key: keyof BundleLineItem, rawVal: string) => {
    const val = sanitizeLineValue(key, rawVal);
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

  const persistLines = () => api.post("/packing-lists", { bookingId, bundleNumber: Number(bundle), items: lines, readySaved: true });

  /** Writes each given bundle to the database (used by both "Confirm" and "Complete repacking"). */
  const persistStagedBundles = async (bundlesToSave: { bundleNumber: number; items: BundleLineItem[] }[]) => {
    for (const b of bundlesToSave) {
      await api.post("/packing-lists", { bookingId, bundleNumber: b.bundleNumber, items: b.items, repackedBy: repackedBy.trim() });
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
      // Advance the active bundle number (what Save tags the staged entry with) so the next
      // Save creates the next bundle instead of overwriting this one. "Actual bundle" itself
      // stays put — only "Bundle count" moves as bundles are created.
      const nextBundle = String(bundleNumber + 1);
      setBundle(nextBundle);
      return;
    }
    const filledCount = lines.filter((l) => l.product || l.qty || l.fabric || l.description).length;
    if (filledCount === 0) {
      setSavedMessage("");
      setError("Add at least one item to the packing list before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await persistLines();
      setSavedMessage(`Saved ${filledCount} item${filledCount === 1 ? "" : "s"} for Bundle ${bundle}.`);
      // Add this bundle's items to "Added items" (replacing any earlier Save of the same bundle).
      const bundleNumber = Number(bundle);
      const newRows: SavedItemRow[] = lines
        .filter((l) => l.product || l.qty || l.fabric || l.description)
        .map((l, index) => ({ id: `${bookingId}-${bundleNumber}-${index}`, bookingCode: booking?.code ?? bookingId, bundleNumber, ...l }));
      setAddedItems((prev) => [...prev.filter((r) => r.bundleNumber !== bundleNumber), ...newRows].sort((x, y) => x.bundleNumber - y.bundleNumber));
      // The entered packing list is saved, so clear the form for the next entry.
      setLines([emptyLine()]);
      // Hide the Packing list until another bundle is selected.
      setPackingListVisible(false);
      // Move the picker on to the next bundle that still has no saved list (this one is now locked).
      if (mode === "ready") {
        const done = new Set(readySavedBundles.get(booking?.code ?? "") ?? []);
        done.add(bundleNumber);
        const next = bundleOptions.find((n) => !done.has(Number(n)));
        if (next) setBundle(next);
      }
      await loadSavedRows();
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
    if (!repackedBy.trim()) {
      setSavedMessage("");
      setError("Enter who repacked these bundles (Repacked by) before confirming.");
      return;
    }
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
      setRepackedBy("");
      await loadSavedRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the bundles.");
    } finally {
      setSaving(false);
    }
  };

  /** "Download packing list" on both screens — the Added bundles (repack) / Added items (ready) rows as a PDF, grouped by bundle. */
  const downloadPackingListAsPdf = async () => {
    // Repack mode prints its staged bundles; ready mode prints the "Added items" rows grouped by bundle.
    const source =
      mode === "repack"
        ? stagedBundles
        : [...new Set(addedItems.map((r) => r.bundleNumber))].map((n) => ({
            bundleNumber: n,
            items: addedItems.filter((r) => r.bundleNumber === n),
          }));
    if (!booking || source.length === 0) return;
    const partyOf = (name: string, kind: "sender" | "receiver") => {
      const found = (kind === "sender" ? senders.items : receivers.items).find((p) => p.name === name);
      return { name, lines: found ? [found.location, found.whatsapp ? `Ph: ${found.whatsapp}` : ""] : [] };
    };
    setError("");
    try {
      await downloadPackingListPdf(`${booking.code}-packing-list.pdf`, {
        lrNo: booking.code,
        bookingDate: fmtDate(booking.date),
        sender: partyOf(booking.sender, "sender"),
        receiver: partyOf(booking.receiver, "receiver"),
        bundles: [...source]
          .sort((a, b) => a.bundleNumber - b.bundleNumber)
          .map((b) => ({
            bundleNo: b.bundleNumber,
            items: b.items
              .filter((i) => i.product || i.qty || i.fabric || i.description)
              .map((i) => ({ product: [i.product, i.fabric].filter(Boolean).join(" - "), qty: i.qty })),
          })),
      });
    } catch {
      setError("Failed to generate the packing list PDF.");
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
  // Ready mode: bundles that already have a saved packing list — shown greyed out and can't be picked again.
  const savedBundleNumbers = mode === "ready" && booking ? readySavedBundles.get(booking.code) : undefined;
  const isBundleSaved = (n: string) => Boolean(savedBundleNumbers?.has(Number(n)));

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
          repackedBy,
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
                {/* Display-only — the bundle number itself advances automatically
                    (selecting a booking, then each Save), Create Bundle just opens
                    whatever count is currently shown here. */}
                <input type="number" min="1" value={bundleInput} disabled style={{ flex: 1 }} />
                <Button
                  size="sm"
                  onClick={createBundle}
                  disabled={!bookingId || !bundleInput || packingListVisible}
                  title={packingListVisible ? "Save the open packing list before creating the next bundle" : undefined}
                >
                  <Plus size={14} /> Create Bundle
                </Button>
              </div>
            </div>
          ) : (
            <div className="cc-field">
              <label>Bundle</label>
              <select value={bundle} onChange={(e) => selectBundle(e.target.value)} disabled={!bookingId}>
                {bundleOptions.map((n) => (
                  <option key={n} value={n} disabled={isBundleSaved(n) && n !== bundle} style={isBundleSaved(n) ? { color: "#9ca3af", opacity: 0.5 } : undefined}>
                    Bundle {n}
                    {isBundleSaved(n) ? " (saved)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <div className="cc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {savedMessage && !(mode === "ready" && !packingListVisible) && <div className="cc-alert-success" style={{ marginBottom: 12 }}>{savedMessage}</div>}

        {bookingId ? (
          loadingList ? (
            <SkeletonTable columns={LINE_COLUMNS.length + 1} rows={3} />
          ) : (
            <>
              {packingListVisible ? (
                <>
                  <div className="cc-mini-label">Packing list</div>
                  {/* Same layout in both modes: net/gross weight on top (default first row
                      only) and the product fields below. "Add item" now sits next to Save
                      below, instead of in a header row above the list. */}
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
                                  inputMode="numeric"
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
                                inputMode={INTEGER_FIELDS.has(c.key) ? "numeric" : "text"}
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

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20 }}>
                    <Button size="sm" onClick={addLine}>
                      <Plus size={14} /> Add item
                    </Button>
                    <Button variant="primary" onClick={saveItems} loading={saving}>
                      {!saving && <Save size={15} />} {saving ? "Saving…" : "Save packing list"}
                    </Button>
                  </div>
                </>
              ) : (
                // Repack mode, before the first Create Bundle click (or right after a Save,
                // when that bundle's fields are done with) — stays out of the way until
                // Create Bundle brings the (blank) packing list fields in.
                <div className="cc-empty">
                  {mode === "ready" && savedMessage && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6, fontWeight: 600, color: colors.success }}>
                      <CheckCircle2 size={18} /> {savedMessage}
                    </div>
                  )}
                  {mode === "ready"
                    ? "Select another bundle above to add its packing list."
                    : "Enter a bundle number and click Create Bundle above to open its packing list."}
                </div>
              )}

              {mode === "repack" && (
                <>
                  <div className="cc-grid-2" style={{ marginTop: 12 }}>
                    <Field
                      field={{ key: "afterCount", label: "Bundle count", type: "number", disabled: true }}
                      value={afterCount}
                      onChange={(_, v) => setAfterCount(v)}
                    />
                    <Field
                      field={{ key: "repackedBy", label: "Repacked by", required: true, placeholder: "Who repacked these bundles?" }}
                      value={repackedBy}
                      onChange={(_, v) => setRepackedBy(sanitizeLineValue("description", v))}
                      error={stagedBundles.length > 0 && !repackedBy.trim() ? "Repacked by is required before you can confirm." : null}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border, rgba(128,128,128,0.25))" }}>
                    <Button
                      variant="primary"
                      onClick={confirmBundles}
                      loading={saving}
                      disabled={!bookingId || stagedBundles.length === 0 || !repackedBy.trim()}
                      title={stagedBundles.length === 0 ? "Save a bundle above first" : !repackedBy.trim() ? "Fill in Repacked by first" : "Save every listed bundle to the database"}
                    >
                      {!saving && <CheckCircle2 size={15} />} {saving ? "Saving…" : "Confirm"}
                    </Button>
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
          {mode === "repack" && (
            <Button
              variant="primary"
              onClick={downloadPackingListAsPdf}
              disabled={!bookingId || stagedBundles.length === 0}
              title={!bookingId ? "Choose a booking above first" : stagedBundles.length === 0 ? "Save a bundle above first" : "Download the added bundles as a PDF"}
            >
              <Download size={15} /> Download packing list
            </Button>
          )}
          {mode === "ready" && (
            <Button
              variant="primary"
              onClick={downloadPackingListAsPdf}
              disabled={!bookingId || addedItems.length === 0}
              title={!bookingId ? "Choose a booking above first" : addedItems.length === 0 ? "Save a packing list above first" : "Download the added items as a PDF"}
            >
              <Download size={15} /> Download packing list
            </Button>
          )}
        </div>
        {mode === "repack" ? (
          // Local staging data — no fetch involved, so no loading skeleton needed.
          <DataTable
            columns={REPACK_ITEM_COLUMNS}
            rows={stagedRows}
            emptyText={bookingId ? "Nothing added yet — save a bundle above." : "Choose a booking above to see its added items here."}
          />
        ) : (
          <DataTable
            columns={SAVED_ITEM_COLUMNS}
            rows={addedItems}
            emptyText={bookingId ? "Nothing saved yet — save a packing list above." : "Choose a booking above to see its added items here."}
          />
        )}
      </div>

      {/* Ready mode doesn't show this table — `savedRows` is still loaded for the Booking ID dropdown's "done" check. */}
      {mode === "repack" && (
        <div className="cc-card" style={{ padding: 18, marginTop: 16 }}>
          <div className="cc-panel-title" style={{ marginBottom: 4 }}>
            {mode === "repack" ? "Saved bundle list" : "Saved packing lists"}
          </div>
          <div className="cc-panel-desc" style={{ marginBottom: 14 }}>
            Every bundle actually saved to the database so far, across every {mode === "repack" ? "Repacking-required" : "Ready-to-ship"} booking
            — fetched fresh from the server, not just this session&apos;s view.
          </div>
          {loadingSavedRows ? (
            <SkeletonTable columns={REPACK_ITEM_COLUMNS.length} rows={4} />
          ) : (
            <DataTable
              columns={mode === "repack" ? REPACK_ITEM_COLUMNS : SAVED_ITEM_COLUMNS}
              rows={savedRows}
              emptyText={mode === "repack" ? "Nothing confirmed yet — click Confirm above." : "Nothing saved yet — save or download a packing list above."}
            />
          )}
        </div>
      )}
    </>
  );
}
