/**
 * CatalogLoader — CLI에서 카탈로그를 로드하는 유틸리티.
 *
 * 우선순위:
 *   1. --catalog 플래그 (명시적 경로)
 *   2. CWD의 qa-sdk.config.ts → catalog 경로
 *   3. DEMO_CATALOG (기본)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** 카탈로그 호환 최소 타입 (core 의존 없이) */
export interface LoadedCatalog {
  readonly id: string;
  readonly name: string;
  readonly axes: Record<string, unknown>;
  readonly prefixes: Record<string, unknown>;
  readonly tables?: Record<string, unknown>;
}

/**
 * 카탈로그를 로드한다.
 *
 * @param catalogPath --catalog 플래그 값 (undefined이면 자동 탐색)
 */
export async function loadCatalog(catalogPath?: string): Promise<LoadedCatalog> {
  // 1. 명시적 --catalog 경로
  if (catalogPath) {
    return loadFromPath(catalogPath);
  }

  // 2. CWD의 qa-sdk.config.ts / qa-sdk.config.js
  const configCandidates = ["qa-sdk.config.ts", "qa-sdk.config.js"];
  for (const candidate of configCandidates) {
    const configPath = resolve(process.cwd(), candidate);
    if (existsSync(configPath)) {
      return loadFromConfig(configPath);
    }
  }

  // 3. DEMO_CATALOG 기본
  return loadDemoCatalog();
}

/** 파일 경로에서 카탈로그 로드 (.ts, .js, .json) */
async function loadFromPath(filePath: string): Promise<LoadedCatalog> {
  const absPath = resolve(process.cwd(), filePath);

  if (!existsSync(absPath)) {
    throw new Error(`카탈로그 파일을 찾을 수 없습니다: ${absPath}`);
  }

  if (absPath.endsWith(".json")) {
    const { readFileSync } = await import("node:fs");
    const content = readFileSync(absPath, "utf-8");
    return JSON.parse(content) as LoadedCatalog;
  }

  // .ts 파일은 jiti 또는 tsx 런타임 필요
  if (absPath.endsWith(".ts")) {
    return loadTypeScriptFile(absPath);
  }

  // .js 파일: dynamic import
  const mod = await import(pathToFileURL(absPath).href);
  return extractCatalog(mod);
}

/** qa-sdk.config.ts/js에서 catalog 경로를 읽어 로드 */
async function loadFromConfig(configPath: string): Promise<LoadedCatalog> {
  let mod: Record<string, unknown>;

  if (configPath.endsWith(".ts")) {
    mod = await loadTypeScriptModule(configPath);
  } else {
    mod = await import(pathToFileURL(configPath).href) as Record<string, unknown>;
  }

  // config에서 catalog 경로 또는 직접 catalog 추출
  const config = (mod.default ?? mod) as Record<string, unknown>;

  if (config.catalog && typeof config.catalog === "string") {
    return loadFromPath(config.catalog);
  }

  if (config.catalog && typeof config.catalog === "object" && "id" in (config.catalog as object)) {
    return config.catalog as LoadedCatalog;
  }

  throw new Error(`qa-sdk.config에서 catalog를 찾을 수 없습니다: ${configPath}`);
}

/** TypeScript 파일을 동적으로 로드 */
async function loadTypeScriptFile(filePath: string): Promise<LoadedCatalog> {
  const mod = await loadTypeScriptModule(filePath);
  return extractCatalog(mod);
}

async function loadTypeScriptModule(filePath: string): Promise<Record<string, unknown>> {
  // jiti로 시도
  try {
    const { createJiti } = await import("jiti" as string);
    const jiti = createJiti(import.meta.url);
    return await jiti.import(filePath) as Record<string, unknown>;
  } catch {
    // jiti 없음 → tsx 런타임 확인
  }

  // tsx 런타임에서 실행 중이면 직접 import 가능
  try {
    return await import(pathToFileURL(filePath).href) as Record<string, unknown>;
  } catch {
    throw new Error(
      `.ts 카탈로그 파일을 로드할 수 없습니다: ${filePath}\n` +
      "해결 방법:\n" +
      "  1. jiti 설치: pnpm add -D jiti\n" +
      "  2. 또는 tsx로 실행: npx tsx node_modules/.bin/qa-sdk ...\n" +
      "  3. 또는 .js/.json 형식 사용",
    );
  }
}

/** 모듈에서 카탈로그 객체 추출 */
function extractCatalog(mod: Record<string, unknown>): LoadedCatalog {
  // default export
  if (mod.default && typeof mod.default === "object" && "prefixes" in (mod.default as object)) {
    return mod.default as LoadedCatalog;
  }

  // named export: catalog 또는 CATALOG 또는 *_CATALOG
  for (const [key, value] of Object.entries(mod)) {
    if (value && typeof value === "object" && "prefixes" in (value as object)) {
      const obj = value as Record<string, unknown>;
      if ("id" in obj && "axes" in obj) {
        return obj as unknown as LoadedCatalog;
      }
    }
  }

  throw new Error("카탈로그 모듈에서 Catalog 객체를 찾을 수 없습니다. default export 또는 named export로 { id, name, axes, prefixes } 객체를 내보내세요.");
}

/** 기본 DEMO_CATALOG 로드 */
async function loadDemoCatalog(): Promise<LoadedCatalog> {
  const { DEMO_CATALOG } = await import("demo-snapshot");
  return DEMO_CATALOG as unknown as LoadedCatalog;
}
