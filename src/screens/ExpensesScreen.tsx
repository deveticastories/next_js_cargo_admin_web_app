"use client";

import { useCargoData } from "@/components/providers/CargoDataProvider";
import { MasterView } from "@/components/shared/MasterView";
import { fmtDate, money } from "@/utils/format";
import type { DailyExpense } from "@/types";

/** Day-to-day operational spends, with a running total in the footer. */
export function ExpensesScreen() {
  const { dailyExpenses } = useCargoData();

  return (
    <MasterView
      title="Daily expense"
      desc="Day-to-day operational spends"
      hasStatus={false}
      fields={[
        { key: "date", label: "Date", type: "date", required: true },
        { key: "type", label: "Expense type", required: true },
        { key: "paymentType", label: "Payment type", type: "select", options: ["Cash", "UPI"], required: true },
        { key: "amount", label: "Amount", type: "number", required: true },
        { key: "description", label: "Description", type: "textarea" },
      ]}
      columns={[
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "type", label: "Type" },
        { key: "paymentType", label: "Payment" },
        { key: "amount", label: "Amount", render: (r) => money(r.amount) },
        { key: "description", label: "Description" },
      ]}
      collection={dailyExpenses}
      footer={(rows: DailyExpense[]) => (
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Total: {money(rows.reduce((sum, r) => sum + Number(r.amount || 0), 0))}
        </div>
      )}
    />
  );
}
