"use client";

/** Read-only queue of bookings that are ready to ship and still waiting to be stuffed into a container. */

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { fmtDate } from "@/utils/format";

export function ReadyToStuffScreen() {
  const { bookings } = useCargoData();
  const rows = bookings.items.filter((b) => b.repackingStatus === "Ready to Ship" && !b.stuffed);
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
      {bookings.loading ? (
        <SkeletonTable columns={6} />
      ) : (
        <DataTable
          emptyText="No bookings are ready to be stuffed."
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
