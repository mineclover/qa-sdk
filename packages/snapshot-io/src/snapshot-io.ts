// @def.boundary apm-codegen-system
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import type { SchemaSnapshot } from "codegen-core";

/** JSON 파일에서 SchemaSnapshot 읽기 */
export async function readSnapshot(path: string): Promise<SchemaSnapshot> {
  const raw = await readFile(path, "utf-8");
  const data = JSON.parse(raw);
  validateSnapshot(data);
  return data;
}

/** 디렉토리 내 모든 .json 파일에서 SchemaSnapshot 읽기 */
export async function readSnapshots(dir: string): Promise<SchemaSnapshot[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && extname(e.name) === ".json")
    .map((e) => join(dir, e.name));

  return Promise.all(files.map(readSnapshot));
}

/** 출력 디렉토리 보장 후 파일 쓰기 */
export async function writeOutput(path: string, content: string): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir) await mkdir(dir, { recursive: true });
  await writeFile(path, content, "utf-8");
}

/** 구조 + 의미 검증 */
function validateSnapshot(data: unknown): asserts data is SchemaSnapshot {
  if (!data || typeof data !== "object") {
    throw new Error("유효하지 않은 SchemaSnapshot: 객체가 아님");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) {
    throw new Error("유효하지 않은 SchemaSnapshot: id 누락");
  }
  if (!Array.isArray(obj.axes)) {
    throw new Error("유효하지 않은 SchemaSnapshot: axes 배열 누락");
  }
  if (!Array.isArray(obj.composites)) {
    throw new Error("유효하지 않은 SchemaSnapshot: composites 배열 누락");
  }

  // 의미 검증
  const axisIds = new Set<string>();
  for (const axis of obj.axes as Array<{ id?: string }>) {
    if (!axis.id) throw new Error("유효하지 않은 SchemaSnapshot: axis에 id 누락");
    if (axisIds.has(axis.id)) {
      throw new Error(`유효하지 않은 SchemaSnapshot: axis ID 중복 — "${axis.id}"`);
    }
    axisIds.add(axis.id);
  }

  for (const comp of obj.composites as Array<{ id?: string; dims?: string[] }>) {
    if (!comp.id) throw new Error("유효하지 않은 SchemaSnapshot: composite에 id 누락");
    if (!Array.isArray(comp.dims) || comp.dims.length === 0) {
      throw new Error(`유효하지 않은 SchemaSnapshot: composite "${comp.id}"에 dims 누락`);
    }
    for (const dim of comp.dims) {
      if (!axisIds.has(dim)) {
        throw new Error(`유효하지 않은 SchemaSnapshot: composite "${comp.id}"의 dim "${dim}"이 axes에 없음`);
      }
    }
  }
}
