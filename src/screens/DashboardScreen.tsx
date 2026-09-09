"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonStatGrid, SkeletonTable } from "@/components/ui/Skeleton";
import { BookingsBarChart } from "@/components/charts/BookingsBarChart";
import { colors } from "@/utils/colors";
import { money } from "@/utils/format";

const FLOW_STEPS = ["Booking", "Repack / Ready to ship", "Stuffing", "Invoicing"];

/** Landing screen: today's key numbers, the booking flow, and recent activity. */
export function DashboardScreen() {
  const { bookings, containers, dailyExpenses, employees } = useCargoData();
  const loading = bookings.loading || containers.loading || dailyExpenses.loading || employees.loading;

  const readyBundles = bookings.items
    .filter((b) => b.repackingStatus === "Ready to Ship")
    .reduce((sum, b) => sum + Number(b.bundleCount || 0), 0);
  const monthExpense = dailyExpenses.items.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const activeContainers = containers.items.filter((c) => c.status === "Active").length;
  const activeStaff = employees.items.filter((e) => e.status === "Active").length;

  const monthly = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.items.forEach((b) => {
      const month = new Date(b.date).toLocaleDateString("en-GB", { month: "short" });
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts).map(([month, count]) => ({ month, count }));
  }, [bookings.items]);

  return (
    <div>
      <div className="cc-flow">
        {FLOW_STEPS.map((step, i) => (
          <span key={step} style={{ display: "contents" }}>
            {i > 0 && <ArrowRight size={14} />}
            <div className={`cc-flow-step ${i === 0 ? "active" : ""}`}>{step}</div>
          </span>
        ))}
      </div>

      {loading ? (
        <SkeletonStatGrid count={5} />
      ) : (
        <div className="cc-stat-grid">
          <StatCard
            label="Total bookings"
            value={bookings.items.length}
            note={`${bookings.items.filter((b) => b.status === "Active").length} active`}
            noteColor={colors.success}
          />
          <StatCard label="Bundles ready to ship" value={readyBundles} note="Packed and waiting" noteColor={colors.success} />
          <StatCard label="Active containers" value={activeContainers} note="In rotation" noteColor={colors.info} />
          <StatCard label="Expense logged" value={money(monthExpense)} />
          <StatCard label="Active staff" value={activeStaff} />
        </div>
      )}

      <div className="cc-two-col">
        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-mini-label">Bookings by month</div>
          {loading ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 200, padding: "0 4px 4px" }}>
              {[70, 45, 85, 55, 60, 40].map((h, i) => (
                <Skeleton key={i} width="100%" height={`${h}%`} radius={4} />
              ))}
            </div>
          ) : (
            <BookingsBarChart data={monthly} />
          )}
        </div>
        <div className="cc-card">
          <div className="cc-panel-head">
            <div className="cc-panel-title">Recent bookings</div>
          </div>
          {loading ? (
            <SkeletonTable columns={4} rows={5} />
          ) : (
            <DataTable
              columns={[
                { key: "code", label: "Booking ID" },
                { key: "sender", label: "Sender" },
                { key: "receiver", label: "Receiver" },
                { key: "repackingStatus", label: "Status", render: (r) => <Badge value={r.repackingStatus} /> },
              ]}
              rows={bookings.items.slice(-5).reverse()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
