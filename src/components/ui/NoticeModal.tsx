import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { colors } from "@/utils/colors";

export interface NoticeModalProps {
  title: string;
  message: string;
  closeLabel?: string;
  onClose: () => void;
}

/**
 * App-styled "heads up" dialog with a single dismiss button — for telling the user an
 * action isn't allowed, where `ConfirmModal`'s Cancel / confirm pair doesn't fit.
 */
export function NoticeModal({ title, message, closeLabel = "Got it", onClose }: NoticeModalProps) {
  return (
    <div className="cc-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cc-modal" role="alertdialog" aria-label={title}>
        <div className="cc-modal-head">
          <div className="cc-panel-title">{title}</div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="cc-modal-body" style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.successBg,
              color: colors.success,
            }}
          >
            <Lock size={18} />
          </span>
          <p style={{ fontSize: 14, color: "var(--text-soft)", margin: 0, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="cc-modal-foot">
          <Button variant="primary" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
