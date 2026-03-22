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
    return JSON.parse(readFileSync(absPath, "utf-8")) as DkgConfig;
  }

  if (absPath.endsWith(".ts")) {
    return loadTypeScriptFile(absPath);
  }

  const mod = await import(pathToFileURL(absPath).href);
  return extractDkgConfig(mod);
}

async function loadFromConfig(configPath: string): Promise<DkgConfig | undefined> {
  let mod: Record<string, unknown>;

  if (configPath.endsWith(".ts")) {
    try {
      const { createJiti } = await import("jiti" as string);
      const jiti = createJiti(import.meta.url);
      mod = await jiti.import(configPath) as Record<string, unknown>;
    } catch {
      try {
        mod = await import(pathToFileURL(configPath).href) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  } else {
    mod = await import(pathToFileURL(configPath).href) as Record<string, unknown>;
  }

  const config = (mod.default ?? mod) as Record<string, unknown>;

  if (config.dkgConfig && typeof config.dkgConfig === "string") {
    return loadFromPath(config.dkgConfig);
  }

  if (config.dkgConfig && typeof config.dkgConfig === "object" && "domains" in (config.dkgConfig as object)) {
    return config.dkgConfig as DkgConfig;
  }

  return undefined;
}

async function loadTypeScriptFile(filePath: string): Promise<DkgConfig> {
  try {
    const { createJiti } = await import("jiti" as string);
    const jiti = createJiti(import.meta.url);
    const mod = await jiti.import(filePath) as Record<string, unknown>;
    return extractDkgConfig(mod);
  } catch {
    try {
      const mod = await import(pathToFileURL(filePath).href) as Record<string, unknown>;
      return extractDkgConfig(mod);
    } catch {
      throw new Error(
        `.ts DkgConfig 파일을 로드할 수 없습니다: ${filePath}\n` +
        "jiti 설치 또는 tsx로 실행하세요.",
      );
    }
  }
}

function extractDkgConfig(mod: Record<string, unknown>): DkgConfig {
  if (mod.default && typeof mod.default === "object" && "domains" in (mod.default as object)) {
    return mod.default as DkgConfig;
  }

  for (const value of Object.values(mod)) {
    if (value && typeof value === "object" && "domains" in (value as object)) {
      const obj = value as Record<string, unknown>;
      if ("dslBundles" in obj || "constraints" in obj) {
        return obj as unknown as DkgConfig;
      }
    }
  }

  throw new Error("DkgConfig 모듈에서 DkgConfig 객체를 찾을 수 없습니다. default export 또는 named export로 { domains, constraints, dslBundles, ... } 객체를 내보내세요.");
}

async function loadDemoDkgConfig(): Promise<DkgConfig | undefined> {
  try {
    const { DEMO_DKG_CONFIG } = await import("demo-snapshot");
    return DEMO_DKG_CONFIG as unknown as DkgConfig;
  } catch {
    return undefined;
  }
}
