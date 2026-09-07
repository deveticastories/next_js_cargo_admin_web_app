/** Three pulsing dots — the standard placeholder for any async "Loading…" state (tables, lists). */
export function Loading() {
  return (
    <div className="cc-loading" role="status" aria-label="Loading">
      <span className="cc-loading-dot" />
      <span className="cc-loading-dot" />
      <span className="cc-loading-dot" />
    </div>
  );
}
