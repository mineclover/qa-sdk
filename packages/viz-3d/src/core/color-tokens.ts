// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * ColorTokens — 시각화 색상 토큰 시스템.
 *
 * CSS 변수, Three.js hex, HUD 표시용 문자열을 하나의 토큰에서 파생.
 * 테마 교체 시 이 파일만 수정하면 전체 색상이 바뀐다.
 *
 * 토큰 구조:
 *   semantic name → { hex, css, rgb }
 *   hex: Three.js에서 사용 (0x64ffda)
 *   css: CSS 변수/인라인에서 사용 ("#64ffda")
 *   rgb: rgba() 조합용 ("100,255,218")
 */

export interface ColorToken {
  readonly hex: number;
  readonly css: string;
  readonly rgb: string;
}

function token(hex: number): ColorToken {
  const r = (hex >> 16) & 0xff,
    g = (hex >> 8) & 0xff,
    b = hex & 0xff;
  return { hex, css: `#${hex.toString(16).padStart(6, '0')}`, rgb: `${r},${g},${b}` };
}

// ═══════════════════════════════════════════════════
//  Base Palette
// ═══════════════════════════════════════════════════

export const PALETTE = {
  // Background / Surface
  bgDeep: token(0x050508),
  bgCard: token(0x080a10),
  bgSurface: token(0x0c0e14),
  bgGrid1: token(0x1a2030),
  bgGrid2: token(0x101520),
  bgAxis: token(0x1a2838),

  // Text
  txtPrimary: token(0xc0c8d8),
  txtSecondary: token(0x667788),
  txtDim: token(0x334455),
  txtMuted: token(0x223344),

  // Accent
  mint: token(0x64ffda),
  cyan: token(0x00b4d8),
  amber: token(0xff9f43),
  orange: token(0xffa502),
  violet: token(0x7c5cfc),
  purple: token(0x6c5ce7),
  rose: token(0xff3860),
  pink: token(0xe84393),
  green: token(0x2ed573),
  red: token(0xff6b6b),

  // State
  connected: token(0x2ed573),
  warning: token(0xff9f43),
  error: token(0xff3860),
  info: token(0x64ffda),
} as const;

// ═══════════════════════════════════════════════════
//  Category Colors (prefix 시각화용)
// ═══════════════════════════════════════════════════

export interface CategoryColor {
  readonly main: ColorToken;
  readonly emissive: ColorToken;
}

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  observation: { main: token(0x00e5ff), emissive: token(0x0097a7) },
  event: { main: token(0xff9100), emissive: token(0xbf6c00) },
  policy: { main: token(0x00e676), emissive: token(0x009624) },
  relation: { main: token(0xb388ff), emissive: token(0x7c4dff) },
  entity: { main: token(0x78909c), emissive: token(0xb0bec5) },
  state: { main: token(0x9575cd), emissive: token(0xd1c4e9) },
  table: { main: token(0xff5252), emissive: token(0xc62828) },
};

// ═══════════════════════════════════════════════════
//  Signal Role Colors (이벤트 흐름 역할별 색상)
// ═══════════════════════════════════════════════════

export interface RoleColor {
  readonly token: ColorToken;
  readonly hex: number;
}

function roleToken(hex: number): RoleColor {
  return { token: token(hex), hex };
}

/** Signal Role → 색상 매핑. 선(beam)/반짝임(glow)/타임라인에 사용. */
export const ROLE_COLORS: Record<string, RoleColor> = {
  context: roleToken(0x4ade80),
  trigger: roleToken(0xfacc15),
  channel: roleToken(0x60a5fa),
  state: roleToken(0xc084fc),
  guard: roleToken(0xf472b6),
  effect: roleToken(0xfb923c),
  data: roleToken(0x94a3b8),
};

// ═══════════════════════════════════════════════════
//  Layer Colors
// ═══════════════════════════════════════════════════

export const LAYER_COLORS: readonly ColorToken[] = [
  token(0x64ffda), // L0 UI — mint
  token(0xff9f43), // L1 Business — amber
  token(0x7c5cfc), // L2 Infra — violet
  token(0xff3860), // L3 Data — rose
];

// ═══════════════════════════════════════════════════
//  CSS Variables 생성
// ═══════════════════════════════════════════════════

/** CSS :root 변수를 생성하는 문자열 반환 */
export function generateCssVariables(): string {
  return [
    `--bg:${PALETTE.bgDeep.css}`,
    `--card:rgba(${PALETTE.bgCard.rgb},0.92)`,
    `--border:rgba(${PALETTE.mint.rgb},0.08)`,
    `--mint:${PALETTE.mint.css}`,
    `--amber:${PALETTE.amber.css}`,
    `--violet:${PALETTE.violet.css}`,
    `--rose:${PALETTE.rose.css}`,
    `--txt:${PALETTE.txtPrimary.css}`,
    `--dim:${PALETTE.txtDim.css}`,
    `--green:${PALETTE.green.css}`,
    `--red:${PALETTE.red.css}`,
    `--cyan:${PALETTE.cyan.css}`,
    // Category
    ...Object.entries(CATEGORY_COLORS).map(([k, v]) => `--cat-${k}:${v.main.css}`),
    // Signal Role
    ...Object.entries(ROLE_COLORS).map(([k, v]) => `--role-${k}:${v.token.css}`),
    // Layer
    ...LAYER_COLORS.map((c, i) => `--layer-${i}:${c.css}`),
  ].join(';');
}

// ═══════════════════════════════════════════════════
//  Theme Presets
// ═══════════════════════════════════════════════════

export type ThemePreset = 'dark' | 'midnight' | 'terminal';

export function getThemeOverrides(preset: ThemePreset): Partial<typeof PALETTE> {
  switch (preset) {
    case 'midnight':
      return {
        bgDeep: token(0x0a0a1a),
        bgCard: token(0x0e1028),
        bgGrid1: token(0x1a1a40),
        mint: token(0x80ffea),
      };
    case 'terminal':
      return {
        bgDeep: token(0x0a0f0a),
        bgCard: token(0x0c140c),
        bgGrid1: token(0x1a2a1a),
        mint: token(0x00ff88),
        amber: token(0xffcc00),
      };
    default:
      return {};
  }
}
