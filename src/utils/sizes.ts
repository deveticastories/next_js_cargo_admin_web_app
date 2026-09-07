/**
 * Cargo Admin sizing tokens — spacing, font sizes, radii.
 *
 * Mirrors the pixel values used in `src/app/admin/admin.css`. Reach for
 * these in JS/TS (e.g. chart tick font size, inline styles); use the `cc-*`
 * CSS classes for everything else.
 */

/** Spacing scale, in px. Use for padding/margin/gap step-ups. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

/** Font sizes, in px. */
export const fontSize = {
  xs: 11.5,
  sm: 12.5,
  base: 13.5,
  md: 15,
  lg: 17,
  xl: 24,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Border radii, in px. */
export const radius = {
  sm: 7,
  md: 9,
  lg: 11,
  xl: 14,
  pill: 20,
  circle: 9999,
} as const;

/** Shared layout dimensions. */
export const layout = {
  sidebarWidth: 250,
  topbarHeight: 60,
  modalMaxWidth: 480,
  mobileBreakpoint: 900,
} as const;

/** Font size + fill color used by recharts axis ticks/tooltips. */
export const chartTick = {
  fontSize: 12,
} as const;
