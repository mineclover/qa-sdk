/**
 * D1 stores 공용 drizzle DB 타입.
 *
 * node-sqlite (Node.js/테스트) 와 D1 (CF Workers) 모두에서 사용 가능한
 * SQLite drizzle 인스턴스 타입을 정의한다.
 */
import type { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import * as schema from "../db/schema.js";

/** node-sqlite drizzle 인스턴스에서 파생된 타입. D1 drizzle도 호환. */
export type D1Db = ReturnType<typeof createD1Drizzle>;

/** Node.js 환경: SqlDriver.$client에서 drizzle 인스턴스 생성 */
export function createD1Drizzle(client: unknown) {
  return drizzle({ client: client as DatabaseSync, schema });
}
