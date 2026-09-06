"use client";

import { useMemo, useState } from "react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { BookingsBarChart } from "@/components/charts/BookingsBarChart";

type ReportTab = "monthly" | "container" | "country" | "customer";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "container", label: "Container-wise" },
  { key: "country", label: "Country-wise" },
  { key: "customer", label: "Customer-wise" },
];

/** Booking activity sliced four ways: by month, container, destination country and sender. */
export function ReportsScreen() {
  const { bookings, containers, stuffings, receivers } = useCargoData();
  const [tab, setTab] = useState<ReportTab>("monthly");

  const monthly = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.items.forEach((b) => {
      const month = new Date(b.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts).map(([month, count]) => ({ month, count }));
  }, [bookings.items]);

  const byContainer = containers.items.map((c) => ({
    id: c.id,
    code: c.code,
    company: c.company,
    bookings: stuffings.items.filter((s) => s.container === c.id).reduce((sum, s) => sum + s.bookings.length, 0),
  }));

  const byCountry = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.items.forEach((b) => {
      const country = receivers.items.find((r) => r.name === b.receiver)?.country || "Unknown";
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts).map(([country, count]) => ({ id: country, country, count }));
  }, [bookings.items, receivers.items]);

  const byCustomer = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.items.forEach((b) => {
      counts[b.sender] = (counts[b.sender] || 0) + 1;
    });
    return Object.entries(counts).map(([sender, count]) => ({ id: sender, sender, count }));
  }, [bookings.items]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "primary" : "default"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "monthly" && (
        <div className="cc-card" style={{ padding: 18 }}>
          <div className="cc-mini-label">Bookings per month</div>
          <BookingsBarChart data={monthly} height={240} />
        </div>
      )}
      {tab === "container" && (
        <div className="cc-card">
          <DataTable
            columns={[
              { key: "code", label: "Container" },
              { key: "company", label: "Shipping line" },
              { key: "bookings", label: "Bookings stuffed" },
            ]}
            rows={byContainer}
            emptyText="No containers yet."
          />
        </div>
      )}
      {tab === "country" && (
        <div className="cc-card">
          <DataTable
            columns={[
              { key: "country", label: "Country" },
              { key: "count", label: "Bookings" },
            ]}
            rows={byCountry}
            emptyText="No bookings yet."
          />
        </div>
      )}
      {tab === "customer" && (
        <div className="cc-card">
          <DataTable
            columns={[
              { key: "sender", label: "Sender" },
              { key: "count", label: "Bookings" },
            ]}
            rows={byCustomer}
            emptyText="No bookings yet."
          />
        </div>
      )}
    </div>
  );
}
