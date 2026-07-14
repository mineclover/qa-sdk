// @def.boundary sim-identifier-grammar
import { z } from 'zod';

export const CATEGORIES = {
  safety: ['perf', 'compatibility', 'decisionQuality', 'auditSafety', 'replicationHealth'],
  resource: ['loadPressure', 'resourceHeadroom', 'stability'],
} as const;

export type DecisionPass = keyof typeof CATEGORIES;
export type DecisionCategoryName =
  | (typeof CATEGORIES)['safety'][number]
  | (typeof CATEGORIES)['resource'][number];

export interface DecisionCategory {
  pass: DecisionPass;
  name: DecisionCategoryName;
}

export const DecisionCategorySchema = z
  .object({
    pass: z.enum(['safety', 'resource']),
    name: z.string(),
  })
  .superRefine((v, ctx) => {
    const allowed = CATEGORIES[v.pass as DecisionPass] as readonly string[];
    if (!allowed.includes(v.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `name "${v.name}" not allowed for pass "${v.pass}"`,
      });
    }
  });

const CATEGORY_PATTERN = /^(safety|resource)\.([a-zA-Z]+)$/;

export function buildDecisionCategory(input: DecisionCategory): string {
  const v = DecisionCategorySchema.parse(input);
  return `${v.pass}.${v.name}`;
}

export function parseDecisionCategory(s: string): DecisionCategory {
  const m = CATEGORY_PATTERN.exec(s);
  if (!m) throw new Error(`invalid decision category: ${s}`);
  const parsed = DecisionCategorySchema.parse({ pass: m[1], name: m[2] });
  return parsed as DecisionCategory;
}
