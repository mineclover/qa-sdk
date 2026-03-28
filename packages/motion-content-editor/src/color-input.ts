function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toHex(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
}

function formatAlpha(value: number): string {
  return clampAlpha(value).toFixed(3).replace(/\.?0+$/, "");
}

function parseHexColor(
  value: string,
): { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const digits = match[1]!;
  if (digits.length === 3) {
    return {
      red: Number.parseInt(digits[0]!.repeat(2), 16),
      green: Number.parseInt(digits[1]!.repeat(2), 16),
      blue: Number.parseInt(digits[2]!.repeat(2), 16),
      alpha: 1,
    };
  }

  if (digits.length === 6) {
    return {
      red: Number.parseInt(digits.slice(0, 2), 16),
      green: Number.parseInt(digits.slice(2, 4), 16),
      blue: Number.parseInt(digits.slice(4, 6), 16),
      alpha: 1,
    };
  }

  return {
    red: Number.parseInt(digits.slice(0, 2), 16),
    green: Number.parseInt(digits.slice(2, 4), 16),
    blue: Number.parseInt(digits.slice(4, 6), 16),
    alpha: Number.parseInt(digits.slice(6, 8), 16) / 255,
  };
}

function parseRgbColor(
  value: string,
): { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number } | null {
  const match = /^rgba?\((.+)\)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const parts = match[1]!.split(",").map((entry) => entry.trim());
  if (parts.length < 3 || parts.length > 4) {
    return null;
  }

  const red = Number(parts[0]);
  const green = Number(parts[1]);
  const blue = Number(parts[2]);
  const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
  if (![red, green, blue, alpha].every((entry) => Number.isFinite(entry))) {
    return null;
  }

  return {
    red: clampByte(red),
    green: clampByte(green),
    blue: clampByte(blue),
    alpha: clampAlpha(alpha),
  };
}

export interface MotionColorControlValue {
  readonly hex: string;
  readonly alpha: number;
}

export function parseMotionColorControlValue(
  value: string,
  fallbackHex = "#000000",
): MotionColorControlValue {
  const parsed = parseHexColor(value) ?? parseRgbColor(value) ?? parseHexColor(fallbackHex) ?? {
    red: 0,
    green: 0,
    blue: 0,
    alpha: 1,
  };
  return {
    hex: `#${toHex(parsed.red)}${toHex(parsed.green)}${toHex(parsed.blue)}`,
    alpha: clampAlpha(parsed.alpha),
  };
}

export function composeMotionColorValue(
  hex: string,
  alpha = 1,
): string {
  const parsed = parseHexColor(hex) ?? parseHexColor("#000000");
  if (!parsed) {
    return "#000000";
  }

  const normalizedAlpha = clampAlpha(alpha);
  if (normalizedAlpha >= 0.999) {
    return `#${toHex(parsed.red)}${toHex(parsed.green)}${toHex(parsed.blue)}`;
  }

  return `rgba(${parsed.red},${parsed.green},${parsed.blue},${formatAlpha(normalizedAlpha)})`;
}
