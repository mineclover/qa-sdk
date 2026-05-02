// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * colors.ts — 색상 보간 및 밀도 기반 색상 계산.
 *
 * 두 앱 모두 density gradient + contrast ink에 사용.
 */

/** 두 hex 색상 사이 선형 보간. t는 0~1 범위. */
export function interpolateHex(from: string, to: string, t: number): string {
  const f = parseInt(from.slice(1), 16);
  const e = parseInt(to.slice(1), 16);
  const fr = (f >> 16) & 0xff, fg = (f >> 8) & 0xff, fb = f & 0xff;
  const er = (e >> 16) & 0xff, eg = (e >> 8) & 0xff, eb = e & 0xff;
  const r = Math.round(fr + (er - fr) * t);
  const g = Math.round(fg + (eg - fg) * t);
  const b = Math.round(fb + (eb - fb) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Navy blue density gradient. from=#e8eef5 → to=#1e3a5f, t 범위를 0.8로 캡. */
export function densityFill(value: number, maxValue: number): string {
  const t = maxValue > 0 ? value / maxValue : 0;
  return interpolateHex("#e8eef5", "#1e3a5f", t * 0.8);
}

/** 배경 밝기 기반 텍스트 색상 선택 (밀도 기반). */
export function densityInk(value: number, maxValue: number): string {
  const t = maxValue > 0 ? value / maxValue : 0;
  return t > 0.5 ? "#ffffff" : "#000000";
}

/** W3C relative luminance 기반 흑/백 선택. */
export function contrastInk(hexColor: string): "#000000" | "#ffffff" {
  const hex = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.179 ? "#000000" : "#ffffff";
}
