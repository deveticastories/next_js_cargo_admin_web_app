import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Color for the note's leading dot, e.g. colors.success — omit for a plain muted note. */
  noteColor?: string;
}

/** One tile in a dashboard/summary stat grid. Wrap a row of these in `.cc-stat-grid`. */
export function StatCard({ label, value, note, noteColor }: StatCardProps) {
  return (
    <div className="cc-stat">
      <div className="cc-stat-label">{label}</div>
      <div className="cc-stat-value cc-h">{value}</div>
      {note && (
        <div className="cc-stat-note" style={noteColor ? { color: noteColor } : undefined}>
          {noteColor && <span className="cc-badge-dot" />}
          {note}
        </div>
      )}
    </div>
  );
}
