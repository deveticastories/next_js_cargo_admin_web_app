"use client";

/**
 * Read-only queue of bookings whose package list is "Added" (every bundle has a packing list saved
 * from Package ready or Repacking — same rule as the Booking screen's column) and whose status is
 * still Pending (not yet stuffed into a container). Ticking bookings and clicking "Go to stuffing"
 * marks them `sentToStuffing`, which moves them off this list and onto the Stuffing screen.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Download, PackageOpen } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ApiError } from "@/utils/apiClient";
import { computeBundleMarkIds, getAllPackages, nameOf, packageBookingId, type PackageBundleDoc } from "@/services/PackageServices";
import { updateStuffStatus } from "@/services/BookingServices";
import { fmtDate, todayISO } from "@/utils/format";
import { downloadTablePdf } from "@/utils/pdf";

export function ReadyToStuffScreen() {
  const { bookings, products, units, fabrics } = useCargoData();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPackingList, setDownloadingPackingList] = useState(false);
  // Every saved bundle (with its mark ID) per booking id, in bundle order — the container packing list's source.
  const [bundlesByBooking, setBundlesByBooking] = useState<Map<string, { bundle: PackageBundleDoc; markId?: number }[]>>(new Map());
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
        const bundles = new Map<string, { bundle: PackageBundleDoc; markId?: number }[]>();
        for (const pkg of packages) {
          const bookingId = packageBookingId(pkg);
          if (!map.has(bookingId)) map.set(bookingId, new Set());
          // Each package's own bundles are already kept in bundleNo order.
          const sortedBundles = [...pkg.bundles].sort((a, b) => a.bundleNo - b.bundleNo);
          for (const bundle of sortedBundles) {
            map.get(bookingId)!.add(bundle.bundleNo);
            const markId = bundle._id ? globalMarkIds.get(bundle._id) : undefined;
            if (!bundles.has(bookingId)) bundles.set(bookingId, []);
            bundles.get(bookingId)!.push({ bundle, markId });
            if (markId) {
              if (!markIds.has(bookingId)) markIds.set(bookingId, []);
              markIds.get(bookingId)!.push(markId);
            }
          }
        }
        setPackedByBooking(map);
        setMarkIdsByBooking(markIds);
        setBundlesByBooking(bundles);
      })
      .catch(() => {
        if (!cancelled) {
          setPackedByBooking(new Map());
          setMarkIdsByBooking(new Map());
          setBundlesByBooking(new Map());
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
  // Distinct units used across a booking's saved packing-list lines, in first-seen order.
  const unitsOf = (bookingId: string) => [
    ...new Set(
      (bundlesByBooking.get(bookingId) ?? []).flatMap(({ bundle }) => bundle.products.map((p) => nameOf(p.unit, units.items)).filter(Boolean))
    ),
  ];
  const kg = (n: number | string | undefined) => `${Number(n || 0)} kg`;
  const totalBundles = rows.reduce((sum, b) => sum + (b.actualBundle || b.bundleCount), 0);
  // Ignore any selected id that has since dropped off the list.
  const selectedIds = selected.filter((id) => rows.some((b) => b.id === id));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const toggle = (id: string) => setSelected(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((b) => b.id));

  // Same as the Booking screen's Download PDF — covers only the ticked bookings.
  const downloadPdf = async () => {
    const picked = rows.filter((b) => selectedIds.includes(b.id));
    if (!picked.length) return;
    setDownloading(true);
    try {
      const total = picked.reduce((sum, b) => sum + (b.actualBundle || b.bundleCount), 0);
      await downloadTablePdf(`ready-to-stuff-${todayISO()}.pdf`, {
        title: "READY TO STUFF",
        info: [
          ["No. of Bookings", String(picked.length)],
          ["No. of Bundles", String(total)],
          ["Generated On", fmtDate(todayISO())],
        ],
        head: ["Sl No", "Booking ID", "Sender", "Receiver", "Bundle Count", "Bundle Mark", "Booking Date"],
        body: picked.map((b, i) => [
          String(i + 1),
          b.code,
          b.sender || "-",
          b.receiver || "-",
          String(b.actualBundle || b.bundleCount),
          markIdsByBooking.get(b.id)?.join(", ") || "-",
          fmtDate(b.date),
        ]),
        foot: ["", "", "", "Total", String(total), "", ""],
      });
    } catch {
      alert("Failed to generate the PDF.");
    } finally {
      setDownloading(false);
    }
  };

  /**
   * "Container packing list" — every saved bundle of the ticked bookings, one row per product
   * line. Bundle-level details (mark ID, booking, bundle no, net/gross weight) print on each
   * bundle's first row only, so the rows underneath read as that bundle's contents.
   */
  const downloadContainerPackingList = async () => {
    const picked = rows.filter((b) => selectedIds.includes(b.id));
    if (!picked.length) return;
    setDownloadingPackingList(true);
    try {
      // Every bundle of the ticked bookings in bundle-mark order, one row per product line; the
      // mark and weights belong to the bundle, so they print on its first line only (as in the app).
      const bundles = picked
        .flatMap((b) => bundlesByBooking.get(b.id) ?? [])
        .sort((x, y) => (x.markId ?? 0) - (y.markId ?? 0));
      let totalQty = 0;
      let totalNet = 0;
      let totalGross = 0;
      const body = bundles.flatMap(({ bundle, markId }, n) => {
        totalNet += Number(bundle.netWeight || 0);
        totalGross += Number(bundle.grossWeight || 0);
        const lines = bundle.products.length ? bundle.products : [undefined];
        return lines.map((line, index) => {
          totalQty += Number(line?.quantity || 0);
          const first = index === 0;
          return [
            first ? String(n + 1) : "",
            first ? (markId ? String(markId) : "-") : "",
            (line && nameOf(line.product, products.items)) || "-",
            line?.quantity ? String(line.quantity) : "-",
            (line && nameOf(line.unit, units.items)) || "-",
            (line && nameOf(line.fabric, fabrics.items)) || "-",
            first ? kg(bundle.netWeight) : "",
            first ? kg(bundle.grossWeight) : "",
          ];
        });
      });
      await downloadTablePdf(`container-packing-list-${todayISO()}.pdf`, {
        title: "CONTAINER PACKING LIST",
        info: [
          ["No. of Bookings", String(picked.length)],
          ["No. of Bundles", String(bundles.length)],
          ["Generated On", fmtDate(todayISO())],
        ],
        head: ["Sl No", "Bundle Mark", "Product Name", "Quantity", "Unit", "Fabric", "N.Wt", "Gr.Wt"],
        body,
        foot: ["", "", "Total", String(totalQty), "", "", kg(Math.round(totalNet * 100) / 100), kg(Math.round(totalGross * 100) / 100)],
      });
    } catch {
      alert("Failed to generate the container packing list PDF.");
    } finally {
      setDownloadingPackingList(false);
    }
  };

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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button
          onClick={downloadPdf}
          loading={downloading}
          disabled={!selectedIds.length}
          title={selectedIds.length ? undefined : "Select at least one booking first"}
        >
          {!downloading && <Download size={15} />} Download PDF{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </Button>
        <Button
          onClick={downloadContainerPackingList}
          loading={downloadingPackingList}
          disabled={!selectedIds.length}
          title={selectedIds.length ? "Every bundle of the selected bookings, with mark IDs, products and weights" : "Select at least one booking first"}
        >
          {!downloadingPackingList && <PackageOpen size={15} />} Container packing list{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </Button>
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
      </div>
      {error && <div className="cc-alert-error" style={{ margin: "0 18px 12px" }}>{error}</div>}
      {bookings.loading || loadingPacked ? (
        <SkeletonTable columns={10} />
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
            { key: "units", label: "Units", render: (r) => unitsOf(r.id).join(", ") || "—" },
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
