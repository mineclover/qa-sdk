export const envSchema = { parse: (s: any) => s };
export type Env = { PORT: number; SQLITE_DRIVER: string; SQLITE_PATH: string };
export function parseEnv(_source: any) {
  return { PORT: 3400, SQLITE_DRIVER: 'node', SQLITE_PATH: ':memory:' };
}
export const env = { PORT: 3400, SQLITE_DRIVER: 'node' as const, SQLITE_PATH: ':memory:' };
