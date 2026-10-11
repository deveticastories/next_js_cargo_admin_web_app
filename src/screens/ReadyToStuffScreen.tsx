"use client";

/**
 * Read-only queue of bookings whose package list is "Added" (every bundle has a packing list saved
 * from Package ready or Repacking — same rule as the Booking screen's column) and whose status is
 * still Pending (not yet stuffed into a container). Ticking bookings and clicking "Go to stuffing"
 * marks them `sentToStuffing`, which moves them off this list and onto the Stuffing screen.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ApiError } from "@/utils/apiClient";
import { computeBundleMarkIds, getAllPackages, packageBookingId } from "@/services/PackageServices";
import { updateStuffStatus } from "@/services/BookingServices";
import { fmtDate } from "@/utils/format";

export function ReadyToStuffScreen() {
  const { bookings } = useCargoData();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  // Bundle numbers with a saved packing list (Package ready or Repacking), per booking id.
  const [packedByBooking, setPackedByBooking] = useState<Map<string, Set<number>>>(new Map());
  // Bundle mark IDs of those saved bundles, per booking id, in bundle order.
  const [markIdsByBooking, setMarkIdsByBooking] = useState<Map<string, number[]>>(new Map());
  const [loadingPacked, setLoadingPacked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllPackages()
      .then((packages) => {
        if (cancelled) return;
        const globalMarkIds = computeBundleMarkIds(packages);
        const map = new Map<string, Set<number>>();
        const markIds = new Map<string, number[]>();
        for (const pkg of packages) {
          const bookingId = packageBookingId(pkg);
          if (!map.has(bookingId)) map.set(bookingId, new Set());
          // Each package's own bundles are already kept in bundleNo order.
          const sortedBundles = [...pkg.bundles].sort((a, b) => a.bundleNo - b.bundleNo);
          for (const bundle of sortedBundles) {
            map.get(bookingId)!.add(bundle.bundleNo);
            const markId = bundle._id ? globalMarkIds.get(bundle._id) : undefined;
            if (markId) {
              if (!markIds.has(bookingId)) markIds.set(bookingId, []);
              markIds.get(bookingId)!.push(markId);
            }
          }
        }
        setPackedByBooking(map);
        setMarkIdsByBooking(markIds);
      })
      .catch(() => {
        if (!cancelled) {
          setPackedByBooking(new Map());
          setMarkIdsByBooking(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPacked(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = bookings.items.filter(
    (b) =>
      !b.stuffed &&
      !b.sentToStuffing &&
      (packedByBooking.get(b.id)?.size ?? 0) >= Math.max(1, b.actualBundle || b.bundleCount || 1)
  );
  const totalBundles = rows.reduce((sum, b) => sum + (b.actualBundle || b.bundleCount), 0);
  // Ignore any selected id that has since dropped off the list.
  const selectedIds = selected.filter((id) => rows.some((b) => b.id === id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const toggle = (id: string) => setSelected(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((b) => b.id));

  const goToStuffing = async () => {
    if (selectedIds.length === 0) return;
    setMoving(true);
    setError("");
    try {
      const failed: string[] = [];
      await Promise.all(
        selectedIds.map(async (id) => {
          try {
            await updateStuffStatus(id, "Ready to Stuff");
          } catch {
            const code = rows.find((b) => b.id === id)?.code ?? id;
            failed.push(code);
          }
        })
      );
      // `updateStuffStatus` bypasses the generic `update()` wrapper, so local state needs an
      // explicit refetch before the bookings that succeeded actually drop off this list.
      await bookings.refetch();
      if (failed.length) {
        setError(`Couldn't move ${failed.join(", ")} to stuffing — please try again.`);
        return;
      }
      setSelected([]);
      router.push("/admin/stuffing");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move the bookings to stuffing.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="cc-card">
      <div className="cc-panel-head">
        <div className="cc-panel-title">
          {rows.length} booking{rows.length === 1 ? "" : "s"} · {totalBundles} bundles
        </div>
        <Button
          variant="primary"
          onClick={goToStuffing}
          loading={moving}
          disabled={selectedIds.length === 0}
          title={selectedIds.length === 0 ? "Select at least one booking first" : undefined}
        >
          {!moving && <ArrowRightLeft size={15} />} Go to stuffing{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>
      {error && <div className="cc-alert-error" style={{ margin: "0 18px 12px" }}>{error}</div>}
      {bookings.loading || loadingPacked ? (
        <SkeletonTable columns={9} />
      ) : (
        <DataTable
          emptyText="No bookings are packed and ready to be stuffed."
          columns={[
            {
              key: "select",
              label: <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all bookings" />,
              render: (r) => <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.code}`} />,
            },
            { key: "code", label: "Booking ID" },
            { key: "sender", label: "Sender" },
            { key: "receiver", label: "Receiver" },
            { key: "bundles", label: "Bundles", render: (r) => r.actualBundle || r.bundleCount },
            {
              key: "bundleMarkIds",
              label: "Bundle mark IDs",
              render: (r) => markIdsByBooking.get(r.id)?.join(", ") || "—",
            },
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "packageListStatus", label: "Package list status", render: () => <Badge value="Added" /> },
            { key: "status", label: "Status", render: () => <Badge value="Pending" /> },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
