// @def.boundary observability-system-root
// @def.doc observability-system-root

import type { MaskingMode, MaskedFieldMarker } from "@qa-sdk/core";

export interface MaskingRule {
  field: string;
  mode: MaskingMode;
}

/**
 * Apply masking rules to a JSON payload.
 * Returns the masked payload and the list of masked field paths.
 */
export function applyMasking(
  payload: Record<string, unknown>,
  rules: MaskingRule[],
): { masked: Record<string, unknown>; maskedFields: string[] } {
  const result = { ...payload };
  const maskedFields: string[] = [];

  for (const rule of rules) {
    if (!(rule.field in result)) continue;

    maskedFields.push(rule.field);

    switch (rule.mode) {
      case "raw":
        // No masking — keep as-is
        break;

      case "mask": {
        const marker: MaskedFieldMarker = {
          _masked: true,
          _present: result[rule.field] !== undefined && result[rule.field] !== null,
        };
        result[rule.field] = marker;
        break;
      }

      case "drop":
        delete result[rule.field];
        break;

      case "hash": {
        const val = result[rule.field];
        result[rule.field] = simpleHash(String(val));
        break;
      }
    }
  }

  return { masked: result, maskedFields };
}

/** Simple string hash for non-cryptographic masking. */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `h_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
