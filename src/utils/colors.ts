/**
 * Cargo Admin color tokens.
 *
 * This is the single source of truth for every color used in the admin panel.
 * The same values are mirrored as CSS custom properties in
 * `src/app/admin/admin.css` (under `.cc-root`) so plain CSS classes can
 * use `var(--accent)` etc. Import from here instead when a color is needed
 * in JS/TS — e.g. a chart fill, an inline style, or a status → color map.
 *
 * Keep this file and the `:root` block in admin.css in sync if a value
 * ever changes.
 */

export const colors = {
  navy: "#0E2337",
  navySoft: "#173350",
  navyLine: "#24405E",

  accent: "#DD8A34",
  accentDark: "#B9701F",
  accentSoft: "#F7E4CB",

  bg: "#EEF2F0",
  surface: "#FFFFFF",
  border: "#DCE3E0",

  text: "#152436",
  textSoft: "#5C6C77",
  textFaint: "#8B98A1",

  success: "#2E8F5C",
  successBg: "#E1F3E7",

  danger: "#C1443A",
  dangerBg: "#FBE9E6",

  warn: "#B9701F",
  warnBg: "#FBECD9",

  info: "#2A6FA8",
  infoBg: "#E3EEF7",
} as const;

export type ColorToken = keyof typeof colors;

/** Background/foreground pair used to render a status pill (see Badge). */
export interface StatusStyle {
  bg: string;
  fg: string;
}

/** Fallback colors for a status value with no explicit mapping. */
export const DEFAULT_STATUS_STYLE: StatusStyle = {
  bg: colors.bg,
  fg: colors.textSoft,
};

/** Every known status/badge label mapped to its display colors. */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  Active: { bg: colors.successBg, fg: colors.success },
  Inactive: { bg: colors.dangerBg, fg: colors.danger },
  "Ready to Ship": { bg: colors.successBg, fg: colors.success },
  "Repacking Required": { bg: colors.warnBg, fg: colors.warn },
  Stuffed: { bg: colors.infoBg, fg: colors.info },
  "With Bill": { bg: colors.infoBg, fg: colors.info },
  "Without Bill": { bg: colors.warnBg, fg: colors.warn },
};
