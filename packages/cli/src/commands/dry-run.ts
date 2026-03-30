/**
 * qa-sdk dry-run — 변경 시뮬레이션.
 *
 * 실제로 아무것도 변경하지 않는다.
 * SchemaSnapshot에 가상의 변경(축 entry 추가/제거, capacity 변경)을 적용하고
 * DAG 전파 결과(stride 변경, overflow, 마이그레이션 필요 여부)를 보여준다.
 *
 * ── 모드 ──
 *   --input (로컬): SchemaSnapshot JSON 기반 로컬 시뮬레이션
 *   --registry (원격): Registry API POST /workspace/simulate 호출
 */

import { readSnapshot } from "snapshot-io";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

// ── Types ────────────────────────────────────────────

export interface DryRunOptions {
  input?: string;
  registry?: string;
  changes: ChangeScenario;
}

/** 축별 capacity 변경 또는 entry 추가/제거 */
export interface ChangeScenario {
  [axisId: string]: {
    capacity?: number;
    addEntries?: string[];
    removeEntries?: string[];
  };
}

interface CompositeImpact {
  id: string;
  dims: string[];
  currentShape: number[];
  currentStride: number[];
  currentProduct: number;
  newShape: number[];
  newStride: number[];
  newProduct: number;
  strideChanged: boolean;
  overflow: boolean;
}

// ── Main ─────────────────────────────────────────────

export async function dryRun(opts: DryRunOptions): Promise<void> {
  if (opts.registry) {
    return dryRunRemote(opts.registry, opts.changes);
  }

  if (opts.input) {
    return dryRunLocal(opts.input, opts.changes);
  }

  throw new Error("--input 또는 --registry 중 하나 필요");
}

// ── 로컬 시뮬레이션 ─────────────────────────────────

async function dryRunLocal(inputPath: string, changes: ChangeScenario): Promise<void> {
  const snapshot = await readSnapshot(inputPath);

  console.log(`Dry-run: "${snapshot.id}"`);
  console.log(`Changes: ${Object.keys(changes).join(", ")}\n`);

  const axisMap = new Map(snapshot.axes.map((a) => [a.id, a]));

  // 변경 적용 후의 축 상태 계산
  const newAxes = new Map<string, { entries: string[]; capacity: number }>();
  for (const axis of snapshot.axes) {
    const change = changes[axis.id];
    if (!change) {
      newAxes.set(axis.id, { entries: axis.entries, capacity: axis.capacity });
      continue;
    }

    let entries = [...axis.entries];
    if (change.addEntries) entries.push(...change.addEntries);
    if (change.removeEntries) {
      const toRemove = change.removeEntries;
      entries = entries.filter((e) => !toRemove.includes(e));
    }
    const capacity = change.capacity ?? axis.capacity;

    // capacity가 entries 수보다 작으면 경고
    if (capacity < entries.length) {
      console.log(`  [E] ${axis.id}: capacity ${capacity} < entries ${entries.length}`);
    }

    newAxes.set(axis.id, { entries, capacity });
    console.log(`  ${axis.id}: ${axis.entries.length} entries (cap ${axis.capacity}) → ${entries.length} entries (cap ${capacity})`);
  }

  // 각 composite의 영향 계산
  const impacts: CompositeImpact[] = [];

  for (const comp of snapshot.composites) {
    const currentShape = comp.dims.map((d) => axisMap.get(d)?.capacity ?? 0);
    const currentStride = calcStrides(currentShape);
    const currentProduct = currentShape.reduce((a, b) => a * b, 1);

    const newShape = comp.dims.map((d) => newAxes.get(d)?.capacity ?? 0);
    const newStride = calcStrides(newShape);
    const newProduct = newShape.reduce((a, b) => a * b, 1);

    impacts.push({
      id: comp.id,
      dims: comp.dims,
      currentShape,
      currentStride,
      currentProduct,
      newShape,
      newStride,
      newProduct,
      strideChanged: !arrEq(currentStride, newStride),
      overflow: newProduct > MAX_SAFE,
    });
  }

  // 결과 출력
  console.log(`\n── Impact ──\n`);

  for (const imp of impacts) {
    const status = imp.overflow ? "[E]" : imp.strideChanged ? "[W]" : "[I]";
    console.log(`${status} ${imp.id} (${imp.dims.join(" × ")})`);
    console.log(`    shape:   [${imp.currentShape}] → [${imp.newShape}]`);
    console.log(`    stride:  [${imp.currentStride}] → [${imp.newStride}]`);
    console.log(`    product: ${imp.currentProduct} → ${imp.newProduct}`);

    if (imp.overflow) {
      console.log(`    !! Number 한계(2^53) 초과 — BigInt 전환 필수`);
    } else if (imp.strideChanged) {
      console.log(`    !! stride 변경 — 마이그레이션 필요`);
    } else {
      console.log(`    stride 불변 — 마이그레이션 불필요`);
    }
    console.log();
  }

  // 요약
  const errors = impacts.filter((i) => i.overflow).length;
  const warnings = impacts.filter((i) => i.strideChanged && !i.overflow).length;
  const safe = impacts.filter((i) => !i.strideChanged && !i.overflow).length;

  console.log(`── Summary ──`);
  console.log(`  composites: ${impacts.length}`);
  console.log(`  safe (stride 불변): ${safe}`);
  console.log(`  migration (stride 변경): ${warnings}`);
  console.log(`  overflow (BigInt 필요): ${errors}`);
  console.log(`  ready: ${errors === 0}`);
}

// ── 원격 시뮬레이션 ─────────────────────────────────

async function dryRunRemote(registry: string, changes: ChangeScenario): Promise<void> {
  // ChangeScenario → Registry API format: Record<string, { capacity: number }>
  const apiChanges: Record<string, { capacity: number }> = {};
  for (const [axisId, change] of Object.entries(changes)) {
    if (change.capacity) {
      apiChanges[axisId] = { capacity: change.capacity };
    }
  }

  const url = new URL("/workspace/simulate", registry);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes: apiChanges }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Registry 오류 (${res.status}): ${errBody}`);
  }

  const result = await res.json() as {
    impact: Array<{
      prefix: string;
      owner: string;
      currentShape: number[];
      newShape: number[];
      currentStride: number[];
      newStride: number[];
      strideChanged: boolean;
      currentProduct: number;
      newProduct: number;
      migrationRequired: boolean;
    }>;
    ready: boolean;
    diagnostics: Array<{ level: string; prefix: string; message: string }>;
    releaseOrder: string[];
  };

  console.log(`Dry-run (remote): ${registry}\n`);

  for (const imp of result.impact) {
    const status = imp.migrationRequired ? "[W]" : "[I]";
    console.log(`${status} ${imp.prefix} (${imp.owner})`);
    console.log(`    shape:   [${imp.currentShape}] → [${imp.newShape}]`);
    console.log(`    stride:  [${imp.currentStride}] → [${imp.newStride}]`);
    console.log(`    product: ${imp.currentProduct} → ${imp.newProduct}`);
    console.log();
  }

  if (result.diagnostics.length > 0) {
    console.log(`── Diagnostics ──\n`);
    for (const d of result.diagnostics) {
      const icon = d.level === "error" ? "E" : d.level === "warn" ? "W" : "I";
      console.log(`  [${icon}] ${d.prefix}: ${d.message}`);
    }
    console.log();
  }

  console.log(`ready: ${result.ready}`);
  if (result.releaseOrder.length > 0) {
    console.log(`release order: ${result.releaseOrder.join(" → ")}`);
  }
}

// ── Helpers ──────────────────────────────────────────

function calcStrides(shape: number[]): number[] {
  const n = shape.length;
  if (n === 0) return [];
  const s = new Array<number>(n);
  s[n - 1] = 1;
  for (let i = n - 2; i >= 0; i--) {
    s[i] = s[i + 1] * shape[i + 1];
  }
  return s;
}

function arrEq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
