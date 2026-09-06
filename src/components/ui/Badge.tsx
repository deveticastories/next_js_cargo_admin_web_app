import { DEFAULT_STATUS_STYLE, STATUS_STYLES } from "@/utils/colors";

/** Colored status pill, e.g. "Active", "Ready to Ship", "With Bill". */
export function Badge({ value }: { value?: string }) {
  const style = (value && STATUS_STYLES[value]) || DEFAULT_STATUS_STYLE;
  return (
    <span className="cc-badge" style={{ background: style.bg, color: style.fg }}>
      {value}
    </span>
  );
}
