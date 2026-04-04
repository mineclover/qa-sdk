/**
 * DefDataSource 팩토리 — 서버/로컬 자동 감지
 *
 * 우선순위:
 * 1. --server 플래그 → ServerDataSource
 * 2. --local 플래그 → LocalDataSource
 * 3. --scan 플래그 → ScanDataSource (read-only degraded mode)
 * 4. 자동: DB 파일 존재 시 local, 아니면 server ping → 성공 시 server, 실패 시 scan
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DefDataSource } from "definition-catalog";
import { LocalDataSource } from "./local-data-source.js";
import { ScanDataSource } from "./scan-data-source.js";
import { ServerDataSource } from "./server-data-source.js";

/** 기본 DB 경로 후보 */
const DB_PATHS = [
  "data/definition-service.sqlite",
  "../data/definition-service.sqlite",
];

/** 기본 서버 URL */
const DEFAULT_SERVER_URL = "http://localhost:3700";

export interface DataSourceOptions {
  /** 강제 모드 */
  mode?: "local" | "server" | "scan";
  /** DB 파일 경로 (local 모드) */
  dbPath?: string;
  /** 서버 URL (server 모드) */
  serverUrl?: string;
  /** 루트 디렉토리 (scan 모드) */
  rootDir?: string;
  /** 문서 디렉토리 (scan 모드) */
  docsDir?: string;
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

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "docs"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

/**
 * 데이터 소스 생성 — 자동 감지 또는 명시적 선택
 */
export async function createDataSource(options: DataSourceOptions = {}): Promise<DefDataSource> {
  const cwd = options.rootDir ?? findWorkspaceRoot(process.cwd());
  const serverUrl = options.serverUrl ?? process.env.DEF_SERVICE_URL ?? DEFAULT_SERVER_URL;
  const docsDir = options.docsDir ?? "docs";
  const docsPath = join(cwd, docsDir);

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
    return new LocalDataSource(dbPath, cwd);
  }
  if (options.mode === "scan") {
    if (!existsSync(docsPath)) {
      throw new Error(`scan 모드 실패: 문서 디렉토리가 없습니다 (${docsPath}).`);
    }
    return ScanDataSource.create(cwd, docsDir);
  }

  // 자동 감지: DB 파일 우선
  const dbPath = options.dbPath ?? findDbPath(cwd);
  if (dbPath) {
    return new LocalDataSource(dbPath, cwd);
  }

  // DB 없으면 서버 시도
  const server = new ServerDataSource(serverUrl);
  if (await server.ping()) {
    return server;
  }

  if (existsSync(docsPath)) {
    console.warn(`[scan] definition DB와 service가 모두 없어 read-only scan fallback을 사용합니다 (${docsPath}).`);
    return ScanDataSource.create(cwd, docsDir);
  }

  throw new Error(
    "데이터 소스를 찾을 수 없습니다.\n" +
    "  - DB 파일: data/definition-service.sqlite (POST /sync로 생성)\n" +
    "  - 서버: definition-service가 :3700에서 응답하지 않음\n" +
    `  - 문서 디렉토리: ${docsPath} 없음`,
  );
}
