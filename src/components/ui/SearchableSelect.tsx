"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { colors } from "@/utils/colors";

export interface SearchableSelectProps {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  /** Display text per option value — shown and searched in place of the raw value. */
  optionLabels?: Record<string, string>;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Bottom-of-list action for when the option being searched for doesn't exist yet — receives whatever text is currently typed in the search box. Omit to hide the row. */
  onCreateNew?: (query: string) => void;
  createLabel?: string;
}

/**
 * A `<select>` with an in-dropdown search box, plus a fallback "create new"
 * row for when nothing matches. Built for the Pre-booking form's Sender
 * field, which needed both — see `PreBookingScreen`.
 */
export function SearchableSelect({
  label,
  required,
  value,
  options,
  optionLabels,
  disabled,
  placeholder = "Search…",
  onChange,
  onCreateNew,
  createLabel = "Add new sender",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const labelOf = (option: string) => optionLabels?.[option] ?? option;
  const filtered = options.filter((o) => labelOf(o).toLowerCase().includes(query.toLowerCase()));

  const openPanel = () => {
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const select = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };
  const createNew = () => {
    setOpen(false);
    onCreateNew?.(query.trim());
  };

  return (
    <div className="cc-field cc-searchselect" ref={rootRef}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="cc-searchselect-control" onClick={open || disabled ? undefined : openPanel} aria-disabled={disabled}>
        {open ? (
          <div className="cc-searchselect-input">
            <Search size={14} color={colors.textFaint} />
            <input
              ref={inputRef}
              autoFocus
              placeholder={`Search ${label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered.length > 0) select(filtered[0]);
              }}
            />
          </div>
        ) : (
          <span className={value ? "" : "cc-searchselect-placeholder"}>{value ? labelOf(value) : placeholder}</span>
        )}
      </div>
      {open && (
        <div className="cc-searchselect-panel">
          <div className="cc-searchselect-list">
            {filtered.length === 0 ? (
              <div className="cc-searchselect-empty">No {label.toLowerCase()} matches &ldquo;{query}&rdquo;</div>
            ) : (
              filtered.map((option) => (
                <div
                  key={option}
                  className={`cc-searchselect-option ${option === value ? "active" : ""}`}
                  onClick={() => select(option)}
                >
                  {labelOf(option)}
                </div>
              ))
            )}
          </div>
          {onCreateNew && (
            <div className="cc-searchselect-create" onClick={createNew}>
              <UserPlus size={14} /> {createLabel}
              {query.trim() ? ` "${query.trim()}"` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
