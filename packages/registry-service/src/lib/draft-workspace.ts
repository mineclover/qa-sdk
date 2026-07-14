// @def.boundary registry-system
// @def.doc registry-system

import type { PrefixRegistry, VersionLifecycleStore } from 'index-meta';
import { calcWeights } from 'weighted-index';
import type { PrefixOwnerStore } from '../stores/prefix-owner-store.js';
import type {
  DiagnosticEntry,
  ImpactEntry,
  SimulateResult,
  AnalyzeResult,
  DraftInfo,
} from '../types/index.js';
import { circularRef } from './errors.js';

const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
const BIGINT_THRESHOLD_RATIO = 0.01; // product가 MAX_SAFE의 1% 이상이면 경고

// ── simulate ────────────────────────────────────────────────

export async function simulate(
  registry: PrefixRegistry,
  ownerStore: PrefixOwnerStore,
  versionStore: VersionLifecycleStore,
  changes: Record<string, { capacity: number }>,
): Promise<SimulateResult> {
  const diagnostics: DiagnosticEntry[] = [];
  const impact: ImpactEntry[] = [];
  const owners = await ownerStore.list();
  const ownerMap = new Map(owners.map((o) => [o.prefix, o]));

  // 변경 대상의 versionId 조회 (draft 우선, 없으면 active 폴백)
  const changeVersionMap = new Map<string, string>();
  for (const prefix of Object.keys(changes)) {
    const drafts = await versionStore.getVersions(prefix, 'draft');
    if (drafts.length > 0) {
      changeVersionMap.set(prefix, drafts[drafts.length - 1].versionId);
    } else {
      // draft 없으면 active 버전으로 폴백 (draft 생성 전 시뮬레이션 지원)
      const active = await versionStore.getActive(prefix);
      if (active) {
        changeVersionMap.set(prefix, active.versionId);
      }
    }
  }

  // 영향받는 composite 찾기: 변경된 prefix를 참조하는 모든 composite
  const affectedComposites = new Set<string>();
  const visited = new Set<string>();

  const findAffected = async (prefix: string, versionId: string) => {
    const key = `${prefix}:${versionId}`;
    if (visited.has(key)) return;
    visited.add(key);

    const reverseRefs = await registry.getReverseRefs(prefix, versionId);
    for (const rr of reverseRefs) {
      affectedComposites.add(`${rr.prefix}:${rr.versionId}`);
      await findAffected(rr.prefix, rr.versionId);
    }
  };

  // 변경된 prefix의 버전에서 역참조 탐색
  for (const [prefix, versionId] of changeVersionMap) {
    await findAffected(prefix, versionId);
  }

  // 첫 루프가 draft를 선택한 경우, active 버전도 역참조 탐색 (historical 버전은 스킵)
  for (const prefix of Object.keys(changes)) {
    const drafts = await versionStore.getVersions(prefix, 'draft');
    if (drafts.length > 0) {
      // 첫 루프에서 draft를 사용했으므로, active도 추가 확인
      const active = await versionStore.getActive(prefix);
      if (active && active.versionId !== changeVersionMap.get(prefix)) {
        await findAffected(prefix, active.versionId);
      }
    }
    // 첫 루프에서 active를 사용한 경우 → 추가 탐색 불필요
  }

  // 각 영향받는 composite의 shape/stride 재계산
  for (const key of affectedComposites) {
    const [prefix, versionId] = splitKey(key);
    const owner = ownerMap.get(prefix);
    if (!owner) continue;

    const record = await registry.getRecord(prefix, versionId);
    if (!record?.refs) continue;

    // 현재 shape/stride
    const currentShape = record.refs.map((r) => r.capacity);
    const currentStride = calcWeights(currentShape);
    const currentProduct = currentShape.reduce((a, b) => a * b, 1);

    // 새 shape: 변경된 prefix의 capacity를 반영
    const newShape = record.refs.map((r) => {
      const change = changes[r.prefix];
      return change ? change.capacity : r.capacity;
    });
    const newStride = calcWeights(newShape);
    const newProduct = newShape.reduce((a, b) => a * b, 1);

    const strideChanged = !arraysEqual(currentStride, newStride);

    impact.push({
      prefix,
      owner: owner.owner,
      currentShape,
      newShape,
      currentStride,
      newStride,
      strideChanged,
      currentProduct,
      newProduct,
      numberType: owner.numberType,
      migrationRequired: strideChanged,
    });

    // diagnostics
    addDiagnostics(diagnostics, prefix, owner.owner, owner.numberType, newProduct, strideChanged);
  }

  const hasError = diagnostics.some((d) => d.level === 'error');

  // release order 계산
  const releaseOrder = await computeSimulateReleaseOrder(
    registry,
    ownerStore,
    versionStore,
    changes,
    affectedComposites,
  );

  return { impact, ready: !hasError, diagnostics, releaseOrder };
}

// ── analyze ─────────────────────────────────────────────────

export async function analyze(
  registry: PrefixRegistry,
  versionStore: VersionLifecycleStore,
  ownerStore: PrefixOwnerStore,
  isLocked: (prefix: string, versionId: string) => boolean | Promise<boolean>,
): Promise<AnalyzeResult> {
  const diagnostics: DiagnosticEntry[] = [];
  const owners = await ownerStore.list();
  const ownerMap = new Map(owners.map((o) => [o.prefix, o]));

  // 모든 draft 수집 (capacity는 prefixRegistry를 진실의 원천으로 사용)
  const drafts: DraftInfo[] = [];
  for (const o of owners) {
    const versions = await versionStore.getVersions(o.prefix, 'draft');
    for (const v of versions) {
      const registryCap = await registry.getCapacity(v.prefix, v.versionId);
      drafts.push({
        prefix: v.prefix,
        versionId: v.versionId,
        owner: o.owner,
        kind: o.kind,
        capacity: registryCap ?? v.capacity,
        status: (await isLocked(v.prefix, v.versionId)) ? 'locked' : 'draft',
      });
    }
  }

  let strideChanges = 0;
  let numberTypeSwitches = 0;
  const affectedPrefixes = new Set<string>();

  // 각 composite draft의 정합성 검증
  for (const d of drafts) {
    if (d.kind !== 'composite') continue;

    const deps = await registry.getDeps(d.prefix, d.versionId);
    if (deps.length === 0) continue;

    const shape = deps.map((r) => r.capacity);
    const product = shape.reduce((a, b) => a * b, 1);
    const owner = ownerMap.get(d.prefix);
    if (!owner) continue;

    // 현재 active 버전과 비교하여 stride 변경 감지
    const active = await versionStore.getActive(d.prefix);
    if (active) {
      const activeShape = await registry.getShape(d.prefix, active.versionId);
      if (activeShape) {
        const activeStride = calcWeights(activeShape);
        const newStride = calcWeights(shape);
        if (!arraysEqual(activeStride, newStride)) {
          strideChanges++;
          affectedPrefixes.add(d.prefix);
          diagnostics.push({
            level: 'warn',
            prefix: d.prefix,
            owner: owner.owner,
            message: `stride 변경: [${activeStride}]→[${newStride}]. 마이그레이션 필요`,
          });
        }
      }
    }

    // overflow / bigint 검증
    if (product > MAX_SAFE && owner.numberType === 'number') {
      diagnostics.push({
        level: 'error',
        prefix: d.prefix,
        owner: owner.owner,
        message: `product ${product} — Number 한계(2^53) 초과. BigInt 전환 필수`,
      });
      numberTypeSwitches++;
    } else if (product > MAX_SAFE * BIGINT_THRESHOLD_RATIO && owner.numberType === 'number') {
      diagnostics.push({
        level: 'warn',
        prefix: d.prefix,
        owner: owner.owner,
        message: `product ${product} — BigInt 전환 임계점 접근 (2^53 대비 ${((product / MAX_SAFE) * 100).toFixed(3)}%)`,
      });
    }
  }

  // 순환 참조 검사
  const cycleCheck = await detectCycles(registry, drafts);
  if (cycleCheck) {
    diagnostics.push({
      level: 'error',
      prefix: cycleCheck.prefix,
      owner: ownerMap.get(cycleCheck.prefix)?.owner ?? 'unknown',
      message: `순환 참조 감지: ${cycleCheck.cycle.join(' → ')}`,
    });
  }

  // 위상정렬
  const releaseOrder = await computeAnalyzeReleaseOrder(registry, drafts);
  const hasError = diagnostics.some((d) => d.level === 'error');

  return {
    ready: !hasError,
    drafts,
    diagnostics,
    releaseOrder,
    migrationSummary: {
      prefixesAffected: affectedPrefixes.size,
      strideChanges,
      numberTypeSwitches,
    },
  };
}

// ── 내부 헬퍼 ───────────────────────────────────────────────

function addDiagnostics(
  diagnostics: DiagnosticEntry[],
  prefix: string,
  owner: string,
  numberType: string,
  newProduct: number,
  strideChanged: boolean,
) {
  if (newProduct > MAX_SAFE && numberType === 'number') {
    diagnostics.push({
      level: 'error',
      prefix,
      owner,
      message: `product ${newProduct} — Number 한계(2^53) 초과. BigInt 전환 필수`,
    });
  } else if (newProduct > MAX_SAFE * BIGINT_THRESHOLD_RATIO && numberType === 'number') {
    diagnostics.push({
      level: 'warn',
      prefix,
      owner,
      message: `product ${newProduct} — BigInt 전환 임계점 접근 (2^53 대비 ${((newProduct / MAX_SAFE) * 100).toFixed(3)}%)`,
    });
  }

  if (strideChanged) {
    diagnostics.push({
      level: 'warn',
      prefix,
      owner,
      message: `stride 변경 감지. 마이그레이션 필요`,
    });
  } else {
    diagnostics.push({
      level: 'info',
      prefix,
      owner,
      message: `stride 불변. 마이그레이션 불필요`,
    });
  }
}

async function detectCycles(
  registry: PrefixRegistry,
  drafts: DraftInfo[],
): Promise<{ prefix: string; cycle: string[] } | null> {
  const visited = new Set<string>();

  const visit = async (
    prefix: string,
    versionId: string,
    visiting: Set<string>,
    path: string[],
  ): Promise<string[] | null> => {
    const key = `${prefix}:${versionId}`;
    if (visited.has(key)) return null;
    if (visiting.has(key)) {
      const cycleStart = path.indexOf(key);
      return [...path.slice(cycleStart).map((k) => k.split(':')[0]), prefix];
    }

    visiting.add(key);
    path.push(key);

    const deps = await registry.getDeps(prefix, versionId);
    for (const dep of deps) {
      const cycle = await visit(dep.prefix, dep.versionId, visiting, path);
      if (cycle) return cycle;
    }

    path.pop();
    visiting.delete(key);
    visited.add(key);
    return null;
  };

  for (const d of drafts) {
    // 각 outer 반복마다 visiting/path 초기화
    const cycle = await visit(d.prefix, d.versionId, new Set(), []);
    if (cycle) return { prefix: d.prefix, cycle };
  }
  return null;
}

async function computeSimulateReleaseOrder(
  registry: PrefixRegistry,
  ownerStore: PrefixOwnerStore,
  versionStore: VersionLifecycleStore,
  changes: Record<string, { capacity: number }>,
  affectedComposites: Set<string>,
): Promise<string[]> {
  // 변경된 prefix + 영향받는 composite를 위상정렬
  const allPrefixes = new Set<string>(Object.keys(changes));
  for (const key of affectedComposites) {
    allPrefixes.add(splitKey(key)[0]);
  }

  const adj = new Map<string, Set<string>>();
  for (const prefix of allPrefixes) {
    adj.set(prefix, new Set());
  }

  for (const key of affectedComposites) {
    const [prefix, versionId] = splitKey(key);
    const deps = await registry.getDeps(prefix, versionId);
    for (const dep of deps) {
      if (allPrefixes.has(dep.prefix)) {
        if (!adj.has(prefix)) adj.set(prefix, new Set());
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get() right after set()
        adj.get(prefix)!.add(dep.prefix);
      }
    }
  }

  return topologicalSort(allPrefixes, adj);
}

async function computeAnalyzeReleaseOrder(
  registry: PrefixRegistry,
  drafts: DraftInfo[],
): Promise<string[]> {
  const allPrefixes = new Set(drafts.map((d) => d.prefix));
  const adj = new Map<string, Set<string>>();

  for (const d of drafts) {
    if (!adj.has(d.prefix)) adj.set(d.prefix, new Set());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Map.get() right after set()
    const prefixAdj = adj.get(d.prefix)!;
    const deps = await registry.getDeps(d.prefix, d.versionId);
    for (const dep of deps) {
      if (allPrefixes.has(dep.prefix)) {
        prefixAdj.add(dep.prefix);
      }
    }
  }

  return topologicalSort(allPrefixes, adj);
}

function topologicalSort(nodes: Set<string>, adj: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const order: string[] = [];

  const visit = (node: string) => {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      // cycle detected — reconstruct cycle path from stack
      const cycleStart = stack.indexOf(node);
      const cyclePath = [...stack.slice(cycleStart), node];
      throw circularRef(`Cycle detected in dependency DAG: ${cyclePath.join(' → ')}`);
    }
    visiting.add(node);
    stack.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const n of neighbors) visit(n);
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    order.push(node);
  };

  for (const n of nodes) visit(n);
  return order;
}

function splitKey(key: string): [string, string] {
  const idx = key.indexOf(':');
  return [key.slice(0, idx), key.slice(idx + 1)];
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
