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
import { downloadFramedTablePdf, downloadTablePdf } from "@/utils/pdf";

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
  // Net / gross weight (kg) summed over a booking's saved bundles.
  const weightsOf = (bookingId: string) =>
    (bundlesByBooking.get(bookingId) ?? []).reduce(
      (sum, { bundle }) => ({ net: sum.net + Number(bundle.netWeight || 0), gross: sum.gross + Number(bundle.grossWeight || 0) }),
      { net: 0, gross: 0 }
    );
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
      const weights = picked.map((b) => weightsOf(b.id));
      await downloadTablePdf(`ready-to-stuff-${todayISO()}.pdf`, {
        title: "READY TO STUFF LIST",
        info: [
          ["Generated On", fmtDate(todayISO())],
          ["No. of Bookings", String(picked.length)],
        ],
        head: ["Sl No", "Booking ID", "Sender", "Receiver", "Bundles", "Bundle Mark IDs", "Units", "Net Wt (kg)", "Gross Wt (kg)", "Date", "Package List", "Status"],
        body: picked.map((b, i) => [
          String(i + 1),
          b.code,
          b.sender,
          b.receiver,
          String(b.actualBundle || b.bundleCount),
          markIdsByBooking.get(b.id)?.join(", ") || "-",
          unitsOf(b.id).join(", ") || "-",
          kg(weights[i].net),
          kg(weights[i].gross),
          fmtDate(b.date),
          "Added",
          "Pending",
        ]),
        foot: [
          "",
          "Total",
          "",
          "",
          String(picked.reduce((sum, b) => sum + (b.actualBundle || b.bundleCount), 0)),
          "",
          "",
          kg(weights.reduce((sum, w) => sum + w.net, 0)),
          kg(weights.reduce((sum, w) => sum + w.gross, 0)),
          "",
          "",
          "",
        ],
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
      const body: string[][] = [];
      let bundleCount = 0;
      let totalQty = 0;
      let totalNet = 0;
      let totalGross = 0;
      for (const b of picked) {
        for (const { bundle, markId } of bundlesByBooking.get(b.id) ?? []) {
          bundleCount += 1;
          totalNet += Number(bundle.netWeight || 0);
          totalGross += Number(bundle.grossWeight || 0);
          const lines = bundle.products.length ? bundle.products : [undefined];
          lines.forEach((line, index) => {
            totalQty += Number(line?.quantity || 0);
            const first = index === 0;
            body.push([
              first ? String(bundleCount) : "",
              first ? String(markId ?? "-") : "",
              first ? b.code : "",
              first ? b.sender : "",
              first ? b.receiver : "",
              first ? String(bundle.bundleNo) : "",
              line ? nameOf(line.product, products.items) || "-" : "-",
              line ? nameOf(line.fabric, fabrics.items) || "-" : "-",
              line ? String(line.quantity ?? "-") : "-",
              line ? nameOf(line.unit, units.items) || "-" : "-",
              line?.description || "-",
              first ? kg(bundle.netWeight) : "",
              first ? kg(bundle.grossWeight) : "",
            ]);
          });
        }
      }
      await downloadFramedTablePdf(`container-packing-list-${todayISO()}.pdf`, {
        title: "CONTAINER PACKING LIST",
        info: [
          ["Generated On", fmtDate(todayISO())],
          ["No. of Bookings", String(picked.length)],
          ["No. of Bundles", String(bundleCount)],
          ["Total Qty", String(totalQty)],
          ["Total Net Wt", kg(totalNet)],
          ["Total Gross Wt", kg(totalGross)],
        ],
        head: ["Sl No", "Bundle Mark ID", "Booking ID", "Sender", "Receiver", "Bundle No", "Product", "Fabric", "Qty", "Unit", "Description", "Net Wt (kg)", "Gross Wt (kg)"],
        body,
        foot: ["", "", "Total", "", "", String(bundleCount), "", "", String(totalQty), "", "", kg(totalNet), kg(totalGross)],
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
