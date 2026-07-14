// @def.boundary sim-identifier-grammar
import { z } from 'zod';

export const VERSION_TAG_STATES = ['stable', 'candidate', 'retired'] as const;
export type VersionTagState = (typeof VERSION_TAG_STATES)[number];

export interface VersionTag {
  axis: 'version';
  value: number;
  state: VersionTagState;
}

const VersionTagInputSchema = z.object({
  axis: z.literal('version'),
  value: z.number().int().positive(),
  state: z.enum(VERSION_TAG_STATES),
});

export const VersionTagSchema = z
  .string()
  .regex(/^v[1-9][0-9]*(-candidate|-retired)?$/, { message: 'invalid version tag' });

export function buildVersionTag(input: VersionTag): string {
  const v = VersionTagInputSchema.parse(input);
  if (v.state === 'stable') return `v${v.value}`;
  return `v${v.value}-${v.state}`;
}

export function parseVersionTag(s: string): VersionTag {
  VersionTagSchema.parse(s);
  const m = s.match(/^v([1-9][0-9]*)(?:-(candidate|retired))?$/)!;
  const value = Number(m[1]);
  const state: VersionTagState = (m[2] as VersionTagState) ?? 'stable';
  return { axis: 'version', value, state };
}
