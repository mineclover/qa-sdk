// @def.boundary weighted-index-system
// @def.doc weighted-index-system

// weighted-ui — Shared UI components and design tokens
// See DESIGN-SYSTEM.md for architecture and component catalog.

// ── Utils (display-related pure functions) ──────────────────────────────────
export { interpolateHex, densityFill, densityInk, contrastInk } from './utils/colors.js';
export { formatLargeNumber, hexPreview, subscript, colLetter } from './utils/format.js';

// ── Components (HTML-string renderers) ──────────────────────────────────────
export { renderHexBar, type HexField } from './components/hex-bar.js';
export { badge, chip, codeBadge, newTag, infoBadge } from './components/badge.js';
export {
  createModeToggle,
  setModeToggleActive,
  type ToggleOption,
} from './components/mode-toggle.js';
