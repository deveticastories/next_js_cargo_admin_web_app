"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { colors } from "@/utils/colors";

export interface SearchableSelectProps {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
  /** Bottom-of-list action for when the option being searched for doesn't exist yet — receives whatever text is currently typed in the search box. */
  onCreateNew: (query: string) => void;
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

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

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
    onCreateNew(query.trim());
  };

  return (
    <div className="cc-field cc-searchselect" ref={rootRef}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="cc-searchselect-control" onClick={open ? undefined : openPanel}>
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
          <span className={value ? "" : "cc-searchselect-placeholder"}>{value || placeholder}</span>
        )}
      </div>
      {open && (
        <div className="cc-searchselect-panel">
          <div className="cc-searchselect-list">
            {filtered.length === 0 ? (
              <div className="cc-searchselect-empty">No sender matches &ldquo;{query}&rdquo;</div>
            ) : (
              filtered.map((option) => (
                <div
                  key={option}
                  className={`cc-searchselect-option ${option === value ? "active" : ""}`}
                  onClick={() => select(option)}
                >
                  {option}
                </div>
              ))
            )}
          </div>
          <div className="cc-searchselect-create" onClick={createNew}>
            <UserPlus size={14} /> {createLabel}
            {query.trim() ? ` "${query.trim()}"` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
