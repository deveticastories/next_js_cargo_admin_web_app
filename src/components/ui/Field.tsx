import type { FieldConfig } from "@/types";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export interface FieldProps {
  field: FieldConfig;
  value: unknown;
  onChange: (key: string, value: string) => void;
  error?: string | null;
}

/**
 * One labeled form input, driven entirely by a `FieldConfig` — renders a
 * text/number/date input, a select, a textarea, or (for "search-select") a
 * searchable dropdown with an "add new" row, depending on `field.type`.
 * Used by every form in the admin panel (see `MasterView`, `BookingScreen`, …)
 * so a new field only ever needs a config object, never new markup.
 */
export function Field({ field, value, onChange, error }: FieldProps) {
  const stringValue = (value as string | number | undefined) ?? "";

  if (field.type === "search-select") {
    return (
      <>
        <SearchableSelect
          label={field.label}
          required={field.required}
          value={String(stringValue)}
          options={field.options ?? []}
          optionLabels={field.optionLabels}
          disabled={field.disabled}
          placeholder={field.placeholder}
          createLabel={field.createLabel}
          onChange={(v) => onChange(field.key, v)}
          onCreateNew={field.onCreateNew}
        />
        {error && <div className="cc-error">{error}</div>}
      </>
    );
  }

  const commonProps = {
    value: stringValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange(field.key, e.target.value),
    disabled: field.disabled,
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
              {field.optionLabels?.[option] ?? option}
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
