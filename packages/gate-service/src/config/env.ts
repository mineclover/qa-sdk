// @def.boundary gate-system
// @def.doc gate-system

import { z } from 'zod';
import { getRequiredServicePort } from '@qa-sdk/core';

const DEFAULT_PORT = getRequiredServicePort('gate-service');

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_DRIVER: z.enum(['node', 'better']).default('node'),
  SQLITE_PATH: z.string().default('data/gate-service.sqlite'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
