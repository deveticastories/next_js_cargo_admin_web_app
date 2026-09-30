"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { colors } from "@/utils/colors";

export interface MultiSearchSelectOption {
  value: string;
  label: string;
  /** Secondary line under the label in the dropdown (e.g. "Sender → Receiver"). Also searched. */
  hint?: string;
}

export interface MultiSearchSelectProps {
  label: string;
  options: MultiSearchSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

/**
 * Multi-pick sibling of `SearchableSelect`: picked options show as removable
 * chips in the control, and the dropdown stays open so several can be picked
 * in a row. Type to filter, ↑/↓ + Enter to toggle, Backspace on an empty
 * search removes the last chip. Used by Invoicing's delivery-note bookings.
 */
export function MultiSearchSelect({ label, options, value, onChange, placeholder = "Search…" }: MultiSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  const selected = new Set(value);
  const byValue = new Map(options.map((o) => [o.value, o]));
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.value));

  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const toggleAllFiltered = () => {
    const ids = filtered.map((o) => o.value);
    onChange(allFilteredSelected ? value.filter((v) => !ids.includes(v)) : [...new Set([...value, ...ids])]);
  };
  const openPanel = () => {
    setOpen(true);
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const moveHighlight = (next: number) => {
    setHighlight(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="cc-field cc-searchselect" ref={rootRef}>
      <label>{label}</label>
      <div className={`cc-searchselect-control cc-multiselect-control ${open ? "open" : ""}`} onClick={openPanel}>
        {value.map((v) => (
          <span key={v} className="cc-chip">
            {byValue.get(v)?.label ?? v}
            <button
              type="button"
              aria-label={`Remove ${byValue.get(v)?.label ?? v}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="cc-multiselect-input">
          {value.length === 0 && <Search size={14} color={colors.textFaint} />}
          <input
            ref={inputRef}
            placeholder={value.length === 0 ? placeholder : "Add more…"}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!open) setOpen(true);
                else if (filtered.length) moveHighlight((highlight + 1) % filtered.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filtered.length) moveHighlight((highlight - 1 + filtered.length) % filtered.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[highlight]) toggle(filtered[highlight].value);
              } else if (e.key === "Backspace" && !query && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
          />
        </div>
        <div className="cc-multiselect-actions">
          {value.length > 0 && (
            <button
              type="button"
              className="cc-multiselect-clear"
              aria-label="Clear all"
              title="Clear all"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} color={colors.textFaint} className={`cc-multiselect-caret ${open ? "open" : ""}`} />
        </div>
      </div>
      {open && (
        <div className="cc-searchselect-panel">
          <div className="cc-multiselect-head">
            <span>
              {value.length} of {options.length} selected
            </span>
            {filtered.length > 0 && (
              <button type="button" onClick={toggleAllFiltered}>
                {allFilteredSelected ? "Clear" : "Select"} {q ? "matches" : "all"}
              </button>
            )}
          </div>
          <div className="cc-searchselect-list" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="cc-searchselect-empty">
                {options.length === 0 ? `No ${label.toLowerCase()} available` : <>No {label.toLowerCase()} matches &ldquo;{query}&rdquo;</>}
              </div>
            ) : (
              filtered.map((o, i) => {
                const isSelected = selected.has(o.value);
                return (
                  <div
                    key={o.value}
                    className={`cc-searchselect-option cc-multiselect-option ${isSelected ? "active" : ""} ${i === highlight ? "highlight" : ""}`}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(o.value)}
                  >
                    <span className={`cc-multiselect-tick ${isSelected ? "on" : ""}`}>{isSelected && <Check size={12} strokeWidth={3} />}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="cc-multiselect-label">{o.label}</span>
                      {o.hint && <span className="cc-multiselect-hint">{o.hint}</span>}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
