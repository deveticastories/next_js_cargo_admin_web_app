/**
 * Small, dependency-free formatting helpers shared across the Cargo Admin
 * panel. Id generation and duplicate-checking (formerly here) now happen
 * server-side — see `withCode` and each model's unique indexes in
 * `src/backend`.
 */

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const fmtDate = (date?: string): string =>
  date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const money = (n: number | string | undefined): string =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * An `<input type="date">` needs exactly `YYYY-MM-DD`, but dates coming
 * back from the API are full ISO timestamps (e.g.
 * `2026-09-05T00:00:00.000Z`) — trim to the date part when populating an
 * edit form.
 */
export const toDateInputValue = (date: unknown): string => (typeof date === "string" ? date.slice(0, 10) : "");

/** Triggers a browser download of `content` as a plain-text file. */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
