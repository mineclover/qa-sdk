export const envSchema = { parse: (s: any) => s };
export type Env = {
  PORT: number;
  SQLITE_DRIVER: string;
  SQLITE_PATH: string;
  GATE_SERVICE_URL: string;
  QUERY_DEFAULT_STRATEGY: string;
  QUERY_GATE_FAILURE_MODE: string;
};
export function parseEnv(_source: any) {
  return {
    PORT: 3500,
    SQLITE_DRIVER: 'node',
    SQLITE_PATH: ':memory:',
    GATE_SERVICE_URL: 'http://localhost:3400',
    QUERY_DEFAULT_STRATEGY: 'most-specific',
    QUERY_GATE_FAILURE_MODE: 'fail-open',
  };
}
export const env = parseEnv({});
