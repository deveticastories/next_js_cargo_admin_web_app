import type { CSSProperties } from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

/**
 * A shimmering placeholder bar — the "shape of the content that's coming,"
 * shown instead of `Loading`'s spinner wherever a screen already knows what
 * shape its data will take (a table, a stat grid, a form) before the fetch
 * resolves. `SkeletonTable` and `SkeletonStatGrid` below compose this into
 * the two shapes every screen in the admin panel actually needs.
 */
export function Skeleton({ width = "100%", height = 14, radius = 6, style }: SkeletonProps) {
  return <span className="cc-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Skeleton shaped like `DataTable`'s rows — same column count, for a list screen's first load. */
export function SkeletonTable({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <Skeleton height={13} width={c === 0 ? "60%" : "80%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton shaped like a row of `StatCard`s — for dashboards/summary rows on first load. */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="cc-stat-grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="cc-stat" key={i}>
          <Skeleton height={11} width="55%" style={{ marginBottom: 12 }} />
          <Skeleton height={28} width="70%" />
        </div>
      ))}
    </div>
  );
}
