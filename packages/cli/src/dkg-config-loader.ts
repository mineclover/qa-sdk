// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * DkgConfigLoader — CLI에서 DkgConfig를 로드하는 유틸리티.
 *
 * 우선순위:
 *   1. --dkg-config 플래그 (명시적 경로)
 *   2. CWD의 qa-sdk.config.ts → dkgConfig 경로
 *   3. DEMO_DKG_CONFIG (기본)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { DkgConfig } from "@qa-sdk/core";

type ModuleShape = {
  readonly default?: unknown;
  readonly dkgConfig?: unknown;
  readonly [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function isDkgConfig(value: unknown): value is DkgConfig {
  if (!isRecord(value)) return false;

  return Array.isArray(value.domains)
    && Array.isArray(value.consumers)
    && Array.isArray(value.constraints)
    && Array.isArray(value.dslBundles)
    && Array.isArray(value.intentLinks)
    && Array.isArray(value.skills)
    && (value.specs === undefined || Array.isArray(value.specs))
    && (value.flowSchemas === undefined || Array.isArray(value.flowSchemas))
    && (value.reviewPairs === undefined || Array.isArray(value.reviewPairs));
}

/**
 * DkgConfig를 로드한다.
 *
 * @param configPath --dkg-config 플래그 값 (undefined이면 자동 탐색)
 * @returns DkgConfig 또는 undefined (로드 불가 시)
 */
export async function loadDkgConfig(configPath?: string): Promise<DkgConfig | undefined> {
  // 1. 명시적 --dkg-config 경로
  if (configPath) {
    return loadFromPath(configPath);
  }

  // 2. CWD의 qa-sdk.config.ts / qa-sdk.config.js에서 dkgConfig 경로 탐색
  const configCandidates = ["qa-sdk.config.ts", "qa-sdk.config.js"];
  for (const candidate of configCandidates) {
    const cfgPath = resolve(process.cwd(), candidate);
    if (existsSync(cfgPath)) {
      const result = await loadFromConfig(cfgPath);
      if (result) return result;
    }
  }

  // 3. DEMO_DKG_CONFIG 기본
  return loadDemoDkgConfig();
}

async function loadFromPath(filePath: string): Promise<DkgConfig> {
  const absPath = resolve(process.cwd(), filePath);

  if (!existsSync(absPath)) {
    throw new Error(`DkgConfig 파일을 찾을 수 없습니다: ${absPath}`);
  }

  if (absPath.endsWith(".json")) {
    const { readFileSync } = await import("node:fs");
    const parsed = JSON.parse(readFileSync(absPath, "utf-8")) as unknown;
    if (isDkgConfig(parsed)) return parsed;
    throw new Error(`DkgConfig JSON 형식이 올바르지 않습니다: ${absPath}`);
  }

  if (absPath.endsWith(".ts")) {
    return loadTypeScriptFile(absPath);
  }

  const mod = await import(pathToFileURL(absPath).href);
  return extractDkgConfig(mod);
}

async function loadFromConfig(configPath: string): Promise<DkgConfig | undefined> {
  let mod: ModuleShape;

  if (configPath.endsWith(".ts")) {
    try {
      const { createJiti } = await import("jiti" as string);
      const jiti = createJiti(import.meta.url);
      mod = await jiti.import(configPath) as ModuleShape;
    } catch {
      try {
        mod = await import(pathToFileURL(configPath).href) as ModuleShape;
      } catch {
        return undefined;
      }
    }
  } else {
    mod = await import(pathToFileURL(configPath).href) as ModuleShape;
  }

  const config = isRecord(mod.default) ? mod.default : mod;

  if (config.dkgConfig && typeof config.dkgConfig === "string") {
    return loadFromPath(config.dkgConfig);
  }

  if (config.dkgConfig && typeof config.dkgConfig === "object" && "domains" in (config.dkgConfig as object)) {
    if (isDkgConfig(config.dkgConfig)) return config.dkgConfig;
  }

  return undefined;
}

async function loadTypeScriptFile(filePath: string): Promise<DkgConfig> {
  try {
    const { createJiti } = await import("jiti" as string);
    const jiti = createJiti(import.meta.url);
    const mod = await jiti.import(filePath) as ModuleShape;
    return extractDkgConfig(mod);
  } catch {
    try {
      const mod = await import(pathToFileURL(filePath).href) as ModuleShape;
      return extractDkgConfig(mod);
    } catch {
      throw new Error(
        `.ts DkgConfig 파일을 로드할 수 없습니다: ${filePath}\n` +
        "jiti 설치 또는 tsx로 실행하세요.",
      );
    }
  }
}

function extractDkgConfig(mod: ModuleShape): DkgConfig {
  if (isDkgConfig(mod.default)) {
    return mod.default;
  }

  for (const value of Object.values(mod)) {
    if (isDkgConfig(value)) {
      return value;
    }
  }

  throw new Error("DkgConfig 모듈에서 DkgConfig 객체를 찾을 수 없습니다. default export 또는 named export로 { domains, constraints, dslBundles, ... } 객체를 내보내세요.");
}

async function loadDemoDkgConfig(): Promise<DkgConfig | undefined> {
  try {
    const { DEMO_DKG_CONFIG } = await import("demo-dkg-config");
    return isDkgConfig(DEMO_DKG_CONFIG) ? DEMO_DKG_CONFIG : undefined;
  } catch {
    return undefined;
  }
}
