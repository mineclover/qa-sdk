/**
 * DefDataSource 팩토리 — 서버/로컬 자동 감지
 *
 * 우선순위:
 * 1. --server 플래그 → ServerDataSource
 * 2. --local 플래그 → LocalDataSource
 * 3. 자동: DB 파일 존재 시 local, 아니면 server ping → 성공 시 server, 실패 시 에러
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DefDataSource } from "definition-catalog";
import { LocalDataSource } from "./local-data-source.js";
import { ServerDataSource } from "./server-data-source.js";

export { LocalDataSource } from "./local-data-source.js";
export { ServerDataSource } from "./server-data-source.js";

/** 기본 DB 경로 후보 */
const DB_PATHS = [
  "data/definition-service.sqlite",
  "../data/definition-service.sqlite",
];

/** 기본 서버 URL */
const DEFAULT_SERVER_URL = "http://localhost:3700";

export interface DataSourceOptions {
  /** 강제 모드 */
  mode?: "local" | "server";
  /** DB 파일 경로 (local 모드) */
  dbPath?: string;
  /** 서버 URL (server 모드) */
  serverUrl?: string;
}

/** DB 파일 자동 탐지 */
function findDbPath(cwd: string): string | null {
  const envPath = process.env.DEF_DB_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  for (const candidate of DB_PATHS) {
    const abs = resolve(cwd, candidate);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/**
 * 데이터 소스 생성 — 자동 감지 또는 명시적 선택
 */
export async function createDataSource(options: DataSourceOptions = {}): Promise<DefDataSource> {
  const cwd = process.cwd();
  const serverUrl = options.serverUrl ?? process.env.DEF_SERVICE_URL ?? DEFAULT_SERVER_URL;

  // 명시적 모드
  if (options.mode === "server") {
    const server = new ServerDataSource(serverUrl);
    if (!await server.ping()) {
      throw new Error(`definition-service (${serverUrl}) 연결 실패. 서비스가 기동 중인지 확인하세요.`);
    }
    return server;
  }
  if (options.mode === "local") {
    const dbPath = options.dbPath ?? findDbPath(cwd);
    if (!dbPath) throw new Error("DB 파일을 찾을 수 없습니다. DEF_DB_PATH를 설정하거나 POST /sync를 실행하세요.");
    return new LocalDataSource(dbPath);
  }

  // 자동 감지: DB 파일 우선
  const dbPath = options.dbPath ?? findDbPath(cwd);
  if (dbPath) {
    return new LocalDataSource(dbPath);
  }

  // DB 없으면 서버 시도
  const server = new ServerDataSource(serverUrl);
  if (await server.ping()) {
    return server;
  }

  throw new Error(
    "데이터 소스를 찾을 수 없습니다.\n" +
    "  - DB 파일: data/definition-service.sqlite (POST /sync로 생성)\n" +
    "  - 서버: definition-service가 :3700에서 응답하지 않음",
  );
}
