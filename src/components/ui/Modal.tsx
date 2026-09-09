import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  /** Shows a spinner on the submit button and disables both buttons while the save request is in flight. */
  submitting?: boolean;
  children: ReactNode;
}

/** Centered dialog used for every create/edit form in the admin panel. Closes on backdrop click. */
export function Modal({ title, onClose, onSubmit, submitLabel = "Save", submitting = false, children }: ModalProps) {
  return (
    <div
      className="cc-modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="cc-modal">
        <div className="cc-modal-head">
          <div className="cc-panel-title">{title}</div>
          <Button variant="ghost" onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="cc-modal-body">{children}</div>
        <div className="cc-modal-foot">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
