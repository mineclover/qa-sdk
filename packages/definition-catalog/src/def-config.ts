/**
 * Definition Config — 루트 설정 파일 관리.
 *
 * 문서 업데이트 시기, 적용된 prefix 버전, 정합성 해시를 추적한다.
 * 파일: <root>/.qa-sdk/def-config.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

/** 머신별 엔티티 상태 */
export interface MachineEntityState {
  readonly current: string;
  readonly updatedAt: string;
}

export interface DefConfig {
  /** 주소 체계 버전 */
  addressVersion: "v1" | "v2";
  /** def_document prefix 버전 */
  prefixVersion: string;
  /** 마지막 동기화 시각 (ISO-8601) */
  lastSyncedAt: string;
  /** 동기화 시점의 문서 수 */
  documentCount: number;
  /** 문서별 content hash (drift 감지) */
  checksums: Record<string, string>;
  /** 머신별 엔티티 상태 — machineId → entityId → { current, updatedAt } */
  states?: Record<string, Record<string, MachineEntityState>>;
}

const CONFIG_PATH = ".qa-sdk/def-config.json";

function defaultConfig(): DefConfig {
  return {
    addressVersion: "v1",
    prefixVersion: "v1",
    lastSyncedAt: "",
    documentCount: 0,
    checksums: {},
  };
}

/** frontmatter 해시 생성 (scope+aspect+depth+level+lifecycle+links) */
export function hashFrontmatter(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/** config 파일 경로 */
export function configPath(root: string): string {
  return join(root, CONFIG_PATH);
}

/** config 읽기 (없으면 기본값) */
export async function readDefConfig(root: string): Promise<DefConfig> {
  try {
    const raw = await readFile(configPath(root), "utf-8");
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

/** config 저장 */
export async function writeDefConfig(root: string, config: DefConfig): Promise<void> {
  const path = configPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + "\n");
}

// ── 머신 상태 헬퍼 ─────────────────────────────────────

/** config에서 머신 상태 조회. 없으면 null 반환. */
export function readMachineState(
  config: DefConfig,
  machineId: string,
  entityId: string,
): MachineEntityState | null {
  return config.states?.[machineId]?.[entityId] ?? null;
}

/** config에 머신 상태 기록. config 객체를 직접 변경 (mutable). */
export function writeMachineState(
  config: DefConfig,
  machineId: string,
  entityId: string,
  state: string,
): void {
  if (!config.states) config.states = {};
  if (!config.states[machineId]) config.states[machineId] = {};
  config.states[machineId][entityId] = {
    current: state,
    updatedAt: new Date().toISOString(),
  };
}

/** config에서 머신별 전체 상태 맵 조회 */
export function readAllMachineStates(
  config: DefConfig,
  machineId: string,
): ReadonlyMap<string, MachineEntityState> {
  const map = new Map<string, MachineEntityState>();
  const section = config.states?.[machineId];
  if (section) {
    for (const [entityId, state] of Object.entries(section)) {
      map.set(entityId, state);
    }
  }
  return map;
}

/** drift 감지 — config의 checksum과 현재 파일의 checksum 비교 */
export interface DriftEntry {
  readonly docId: string;
  readonly kind: "added" | "modified" | "removed";
}

export function detectDrift(
  config: DefConfig,
  currentChecksums: Record<string, string>,
): readonly DriftEntry[] {
  const drift: DriftEntry[] = [];

  // 추가/변경
  for (const [docId, hash] of Object.entries(currentChecksums)) {
    if (!(docId in config.checksums)) {
      drift.push({ docId, kind: "added" });
    } else if (config.checksums[docId] !== hash) {
      drift.push({ docId, kind: "modified" });
    }
  }

  // 삭제
  for (const docId of Object.keys(config.checksums)) {
    if (!(docId in currentChecksums)) {
      drift.push({ docId, kind: "removed" });
    }
  }

  return drift;
}
