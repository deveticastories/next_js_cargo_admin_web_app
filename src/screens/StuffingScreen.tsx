"use client";

/**
 * Load ready-to-ship bookings into a container. Submitting calls
 * `POST /api/stuffings`, which atomically records the stuffing, marks the
 * chosen bookings as stuffed, and copies them into the UAE store's
 * incoming log — then this screen just refetches those two collections.
 */

import { useState } from "react";
import { ArrowRightLeft, Download } from "lucide-react";
import { useCargoData } from "@/components/providers/CargoDataProvider";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/utils/apiClient";
import { downloadText, fmtDate } from "@/utils/format";
import type { Booking } from "@/types";

interface StuffingSummary {
  code: string;
  containerCode: string;
  bookings: Booking[];
}

export function StuffingScreen() {
  const { bookings, containers, uaeStoreLog } = useCargoData();
  const [containerId, setContainerId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastSummary, setLastSummary] = useState<StuffingSummary | null>(null);

  const eligible = bookings.items.filter((b) => b.repackingStatus === "Ready to Ship" && !b.stuffed);
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const submit = async () => {
    if (!containerId || selected.length === 0) {
      alert("Choose a container and at least one booking.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const stuffedBookings = bookings.items.filter((b) => selected.includes(b.id));
      const created = await api.post<{ code: string }>("/stuffings", { containerId, bookingIds: selected });
      const container = containers.items.find((c) => c.id === containerId);
      setLastSummary({ code: created.code, containerCode: container?.code ?? "", bookings: stuffedBookings });
      await Promise.all([bookings.refetch(), uaeStoreLog.refetch()]);
      setSelected([]);
      setContainerId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit stuffing.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSummary = () => {
    if (!lastSummary) return;
    const rows = lastSummary.bookings.map((b) => `${b.code} | ${b.sender} → ${b.receiver} | ${b.bundleCount} bundles`).join("\n");
    downloadText(`${lastSummary.code}-booking-summary.txt`, `Stuffing ${lastSummary.code} — Container ${lastSummary.containerCode}\n\n${rows}`);
  };

  return (
    <div>
      <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="cc-field" style={{ maxWidth: 360, marginBottom: 14 }}>
          <label>Container</label>
          <select value={containerId} onChange={(e) => setContainerId(e.target.value)}>
            <option value="">Choose a container</option>
            {containers.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.company}
              </option>
            ))}
          </select>
        </div>
        <div className="cc-mini-label">Ready-to-ship bookings available for stuffing</div>
        {error && <div className="cc-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        {bookings.loading ? (
          <SkeletonTable columns={5} rows={3} />
        ) : eligible.length === 0 ? (
          <div className="cc-empty">No ready-to-ship bookings are waiting to be stuffed.</div>
        ) : (
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Booking ID</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Bundles</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
                    </td>
                    <td>{b.code}</td>
                    <td>{b.sender}</td>
                    <td>{b.receiver}</td>
                    <td>{b.bundleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Button variant="primary" onClick={submit} loading={submitting}>
            {!submitting && <ArrowRightLeft size={15} />} {submitting ? "Submitting…" : "Submit stuffing"}
          </Button>
        </div>
      </div>

      {lastSummary && (
        <div className="cc-card" style={{ padding: 18, marginBottom: 18 }}>
          <div className="cc-mini-label">Stuffing {lastSummary.code} completed</div>
          <div className="cc-note-box" style={{ marginBottom: 12 }}>
            Booking summary was auto-sent to each receiver&apos;s registered WhatsApp number, and the stuffed list has been copied to the UAE store.
          </div>
          <Button onClick={downloadSummary}>
            <Download size={15} /> Download booking summary
          </Button>
        </div>
      )}

      <div className="cc-card">
        <div className="cc-panel-head">
          <div className="cc-panel-title">UAE store — incoming log</div>
        </div>
        {uaeStoreLog.loading ? (
          <SkeletonTable columns={4} />
        ) : (
          <DataTable
            emptyText="Nothing has arrived at the UAE store yet."
            columns={[
              { key: "booking", label: "Booking ID", render: (r) => bookings.items.find((b) => b.id === r.booking)?.code ?? "—" },
              { key: "receiver", label: "Receiver" },
              { key: "bundles", label: "Bundles" },
              { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            ]}
            rows={uaeStoreLog.items.slice().reverse()}
          />
        )}
      </div>
    </div>
  );
}
