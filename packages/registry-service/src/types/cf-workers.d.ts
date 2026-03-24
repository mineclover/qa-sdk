/** CF Workers Fetcher 타입 (Service Bindings) — tsc 빌드 호환용 */
declare interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

/** CF Workers D1Database — wrangler 런타임 제공 */
declare interface D1Database {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): D1PreparedStatement;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(column?: string): Promise<T | null>;
  run(): Promise<D1Result>;
}

declare interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}
