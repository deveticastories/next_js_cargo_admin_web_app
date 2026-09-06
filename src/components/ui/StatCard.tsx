import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}

/** One tile in a dashboard/summary stat grid. Wrap a row of these in `.cc-stat-grid`. */
export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className="cc-stat">
      <div className="cc-stat-label">{label}</div>
      <div className="cc-stat-value cc-h">{value}</div>
      {note && <div className="cc-stat-note">{note}</div>}
    </div>
  );
}
