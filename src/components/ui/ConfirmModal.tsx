import { Modal } from "@/components/ui/Modal";

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Shows a spinner on the confirm button while the action it triggers is in flight. */
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * App-styled "Are you sure?" dialog — a thin wrapper around `Modal` for the
 * cases that used to be a plain `window.confirm()` (e.g. a status-badge
 * click) but need to match the rest of the admin panel's look instead of the
 * browser's own alert styling.
 */
export function ConfirmModal({ title, message, confirmLabel = "Yes, continue", submitting = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel} onSubmit={onConfirm} submitLabel={confirmLabel} submitting={submitting}>
      <p style={{ fontSize: 14, color: "var(--text-soft)", margin: 0 }}>{message}</p>
    </Modal>
  );
}
