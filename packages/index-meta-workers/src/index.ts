// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * index-meta-workers — Cloudflare Workers / Edge 런타임 전용 패키지
 *
 * index-meta의 Workers 호환 서브셋을 re-export한다.
 * Node.js 전용 드라이버(NodeSqliteDriver, BetterSqliteDriver, BunSqliteDriver)를
 * 포함하지 않으므로 Cloudflare Workers, Deno Deploy, Vercel Edge 등에서
 * 안전하게 사용 가능하다.
 *
 * @example
 * ```ts
 * import { D1SqlDriver, GateEngine, PrefixDecoder } from "index-meta-workers";
 * ```
 */
export * from 'index-meta/workers';
