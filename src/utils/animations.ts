/**
 * Standard animation tokens for the Cargo Admin panel.
 *
 * Keep every transition/animation in the admin panel built from these values so
 * motion feels consistent across screens. The matching keyframes
 * (`cc-fade-in`, `cc-scale-in`, `cc-slide-up`) live in
 * `src/app/admin/admin.css`, next to the classes that use them:
 *
 *   - `.cc-content`      → fades/slides in on every route change
 *   - `.cc-modal`        → scales in when opened
 *   - `.cc-sidebar`      → slides in/out on mobile
 *   - `.cc-navitem`, `.cc-btn`, table rows → color/background transitions
 */

export const duration = {
  fast: "0.12s",
  base: "0.18s",
  slow: "0.28s",
} as const;

export const easing = {
  standard: "ease",
  decelerate: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/** Ready-to-use `transition` shorthand values for inline styles. */
export const transition = {
  colors: `background-color ${duration.fast} ${easing.standard}, color ${duration.fast} ${easing.standard}, border-color ${duration.fast} ${easing.standard}`,
  transform: `transform ${duration.base} ${easing.decelerate}`,
} as const;
