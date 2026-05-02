import { z } from "zod";

export const LABEL_KEYS = ["role", "version", "replica-of"] as const;
export type LabelKeyName = (typeof LABEL_KEYS)[number];

export interface LabelKey {
  namespace: "sim";
  key: LabelKeyName;
}

export const LabelKeySchema = z.object({
  namespace: z.literal("sim"),
  key: z.enum(LABEL_KEYS),
});

const LABEL_KEY_PATTERN = /^(sim)\.(role|version|replica-of)$/;
export const LabelKeyStringSchema = z.string().regex(LABEL_KEY_PATTERN);

export function buildLabelKey(input: LabelKey): string {
  const v = LabelKeySchema.parse(input);
  const out = `${v.namespace}.${v.key}`;
  return LabelKeyStringSchema.parse(out);
}

export function parseLabelKey(s: string): LabelKey {
  const m = LABEL_KEY_PATTERN.exec(s);
  if (!m) throw new Error(`invalid label key: ${s}`);
  return {
    namespace: m[1] as "sim",
    key: m[2] as LabelKeyName,
  };
}
