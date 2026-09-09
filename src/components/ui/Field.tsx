import type { FieldConfig } from "@/types";

export interface FieldProps {
  field: FieldConfig;
  value: unknown;
  onChange: (key: string, value: string) => void;
  error?: string | null;
}

/**
 * One labeled form input, driven entirely by a `FieldConfig` — renders a
 * text/number/date input, a select, or a textarea depending on `field.type`.
 * Used by every form in the admin panel (see `MasterView`, `BookingScreen`, …)
 * so a new field only ever needs a config object, never new markup.
 */
export function Field({ field, value, onChange, error }: FieldProps) {
  const stringValue = (value as string | number | undefined) ?? "";
  const commonProps = {
    value: stringValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange(field.key, e.target.value),
  };

  return (
    <div className="cc-field">
      <label>
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.type === "select" ? (
        <select {...commonProps}>
          <option value="">Choose {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea rows={3} {...commonProps} />
      ) : (
        <input type={field.type ?? "text"} placeholder={field.placeholder} {...commonProps} />
      )}
      {error && <div className="cc-error">{error}</div>}
    </div>
  );
}
