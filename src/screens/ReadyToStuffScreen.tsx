"use client";

/**
 * Read-only queue of bookings that are ready to ship, still waiting to be stuffed into a container,
 * and fully done on the Package ready screen (every bundle has a saved packing list).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { api } from "@/utils/apiClient";
import { fmtDate } from "@/utils/format";

export function ReadyToStuffScreen() {
  const { bookings } = useCargoData();
  // Bundle numbers saved from the Package ready screen, per booking id.
  const [packedByBooking, setPackedByBooking] = useState<Map<string, Set<number>>>(new Map());
  const [loadingPacked, setLoadingPacked] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ booking: string; bundleNumber: number; readySaved?: boolean }[]>("/packing-lists")
      .then((lists) => {
        if (cancelled) return;
        const map = new Map<string, Set<number>>();
        for (const l of lists) {
          if (!l.readySaved) continue;
          if (!map.has(l.booking)) map.set(l.booking, new Set());
          map.get(l.booking)!.add(l.bundleNumber);
        }
        setPackedByBooking(map);
      })
      .catch(() => {
        if (!cancelled) setPackedByBooking(new Map());
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
      b.repackingStatus === "Ready to Ship" &&
      !b.stuffed &&
      (packedByBooking.get(b.id)?.size ?? 0) >= Math.max(1, b.actualBundle || b.bundleCount || 1)
  );
  const totalBundles = rows.reduce((sum, b) => sum + (b.actualBundle || b.bundleCount), 0);

  return (
    <div className="cc-card">
      <div className="cc-panel-head">
        <div className="cc-panel-title">
          {rows.length} booking{rows.length === 1 ? "" : "s"} · {totalBundles} bundles
        </div>
        <Link href="/admin/stuffing" className="cc-btn">
          <ArrowRightLeft size={15} /> Go to stuffing
        </Link>
      </div>
      {bookings.loading || loadingPacked ? (
        <SkeletonTable columns={6} />
      ) : (
        <DataTable
          emptyText="No bookings are packed and ready to be stuffed."
          columns={[
            { key: "code", label: "Booking ID" },
            { key: "sender", label: "Sender" },
            { key: "receiver", label: "Receiver" },
            { key: "bundles", label: "Bundles", render: (r) => r.actualBundle || r.bundleCount },
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "status", label: "Status", render: (r) => <Badge value={r.repackingStatus} /> },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
}
