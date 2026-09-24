/**
 * Cargo Admin color tokens.
 *
 * Palette matches the "Cargo Admin.dc.html" design reference: a deep forest
 * green instead of navy/orange, expressed in OKLCH (perceptually uniform,
 * so tints/shades stay consistent — see https://oklch.com).
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
  // Sidebar / dark surfaces
  ink: "oklch(0.24 0.035 228)",
  inkSoft: "oklch(0.30 0.04 228)",
  inkLine: "oklch(0.35 0.035 228)",

  // Brand green — primary buttons, links, active states
  accent: "oklch(0.50 0.095 228)",
  accentDark: "oklch(0.42 0.09 228)",
  accentSoft: "oklch(0.95 0.03 228)",

  bg: "oklch(0.985 0.004 228)",
  surface: "#FFFFFF",
  border: "oklch(0.92 0.008 228)",

  text: "oklch(0.24 0.012 228)",
  textSoft: "oklch(0.52 0.012 228)",
  textFaint: "oklch(0.65 0.012 228)",

  success: "oklch(0.46 0.09 155)",
  successBg: "oklch(0.95 0.03 155)",

  danger: "oklch(0.50 0.13 25)",
  dangerBg: "oklch(0.96 0.03 25)",

  warn: "oklch(0.50 0.10 70)",
  warnBg: "oklch(0.96 0.04 80)",

  info: "oklch(0.48 0.10 285)",
  infoBg: "oklch(0.955 0.03 285)",

  // Extra accent used sparingly (e.g. a "Superadmin"-style role pill)
  violet: "oklch(0.44 0.10 300)",
  violetBg: "oklch(0.955 0.03 300)",
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
  Pending: { bg: colors.warnBg, fg: colors.warn },
  Collected: { bg: colors.successBg, fg: colors.success },
  Canceled: { bg: colors.dangerBg, fg: colors.danger },
  Active: { bg: colors.successBg, fg: colors.success },
  Inactive: { bg: colors.dangerBg, fg: colors.danger },
  "Ready to Ship": { bg: colors.successBg, fg: colors.success },
  "Repacking Required": { bg: colors.warnBg, fg: colors.warn },
  Stuffed: { bg: colors.infoBg, fg: colors.info },
  Added: { bg: colors.successBg, fg: colors.success },
  "With Bill": { bg: colors.infoBg, fg: colors.info },
  "Without Bill": { bg: colors.warnBg, fg: colors.warn },
  Paid: { bg: colors.successBg, fg: colors.success },
  Unpaid: { bg: colors.dangerBg, fg: colors.danger },
};
