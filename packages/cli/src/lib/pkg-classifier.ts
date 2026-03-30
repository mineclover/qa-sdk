/**
 * 모노레포 패키지 스캔 및 분류.
 *
 * pnpm workspace의 packages/* 디렉토리를 순회하여
 * 각 패키지의 메타데이터를 추출하고 tier/runtime/scope를 분류한다.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// ── Types ────────────────────────────────────────────

export interface ClassifiedPackage {
  /** package.json name (scoped 포함) */
  name: string;
  /** scope 제거한 이름 (축 entry 값) */
  displayName: string;
  /** package.json version */
  version: string;
  /** packages/ 하위 디렉토리명 */
  dir: string;
  /** 아키텍처 계층 */
  tier: string;
  /** 실행 환경 */
  runtime: string;
  /** npm 공개 범위 */
  scope: "public" | "private";
  /** 모노레포 내부 의존 패키지 (displayName 기준) */
  deps: string[];
}

// ── Scan ─────────────────────────────────────────────

interface RawPkg {
  name: string;
  displayName: string;
  version: string;
  dir: string;
  isScoped: boolean;
  isPrivate: boolean;
  allDeps: Record<string, string>;
}

/** packages/* 디렉토리의 모든 패키지를 스캔하고 분류한다 */
export async function scanAndClassify(root: string): Promise<ClassifiedPackage[]> {
  const packagesDir = join(root, "packages");
  const entries = await readdir(packagesDir, { withFileTypes: true });

  // Phase 1: package.json 읽기
  const raws: RawPkg[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const pkgPath = join(packagesDir, entry.name, "package.json");
      const raw = await readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      const name: string = pkg.name ?? entry.name;

      raws.push({
        name,
        displayName: name.replace(/^@[^/]+\//, ""),
        version: pkg.version ?? "0.0.0",
        dir: entry.name,
        isScoped: name.startsWith("@"),
        isPrivate: pkg.private === true,
        allDeps: { ...pkg.dependencies },
      });
    } catch {
      // package.json 없으면 skip
    }
  }

  // Phase 2: 내부 의존 해석 + 분류
  const nameSet = new Set(raws.map((r) => r.name));
  const displaySet = new Set(raws.map((r) => r.displayName));

  return raws.map((raw) => {
    const internalDeps = Object.keys(raw.allDeps)
      .filter((dep) => nameSet.has(dep) || displaySet.has(dep))
      .map((dep) => dep.replace(/^@[^/]+\//, ""));

    return {
      name: raw.name,
      displayName: raw.displayName,
      version: raw.version,
      dir: raw.dir,
      tier: classifyTier(raw),
      runtime: classifyRuntime(raw),
      scope: raw.isScoped ? ("private" as const) : ("public" as const),
      deps: internalDeps,
    };
  });
}

// ── Classification heuristics ────────────────────────

function classifyTier(raw: RawPkg): string {
  const n = raw.displayName;
  if (/(-server|-service)$/.test(n)) return "service";
  if (
    /(-demo|-web)$/.test(n) ||
    n.startsWith("browser-") ||
    n.startsWith("viz-") ||
    n.startsWith("registry-ui")
  )
    return "app";
  if (n.startsWith('demo-')) return "data";
  if (n === "cli") return "service";
  if (raw.isScoped) return "platform";
  return "foundation";
}

function classifyRuntime(raw: RawPkg): string {
  const n = raw.displayName;
  if (/(-server|-service)$/.test(n) || n === "cli") return "server";
  if (
    n.startsWith("browser-") ||
    n.startsWith("viz-") ||
    n.endsWith('-web') ||
    n === "registry-ui" ||
    n.endsWith('-demo')
  )
    return "browser";
  return "library";
}
