// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk register — SchemaSnapshot을 Registry에 등록.
 *
 * CLI는 시스템을 변경하지 않는다.
 * 외부에서 이미 결정된 상태(SchemaSnapshot)를 Registry에 기록할 뿐이다.
 *
 * 흐름: scan → (SchemaSnapshot JSON) → register → (Registry에 기록)
 */

import { stat } from "node:fs/promises";
import { readSnapshot, readSnapshots } from "snapshot-io";

export interface RegisterOptions {
  registry: string;
  input: string;
  versionId: string;
}

export async function register(opts: RegisterOptions): Promise<void> {
  // 1. SchemaSnapshot 로드
  const info = await stat(opts.input);
  const snapshots = info.isDirectory()
    ? await readSnapshots(opts.input)
    : [await readSnapshot(opts.input)];

  if (snapshots.length === 0) {
    console.log("등록할 SchemaSnapshot이 없음");
    return;
  }

  // 2. 각 스냅샷을 Registry에 등록
  for (const snapshot of snapshots) {
    console.log(`Registering "${snapshot.id}" → ${opts.registry}`);

    const url = new URL("/schema/import", opts.registry);
    const body = { snapshot, versionId: opts.versionId };

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Registry 오류 (${res.status}): ${errBody}`);
    }

    const result = await res.json() as {
      imported: { axes: number; composites: number; versionId: string };
      analysis: {
        ready: boolean;
        diagnostics: Array<{ level: string; prefix: string; message: string }>;
        releaseOrder: string[];
      };
    };

    // 3. 결과 출력
    console.log(`  axes: ${result.imported.axes}, composites: ${result.imported.composites}`);
    console.log(`  versionId: ${result.imported.versionId}`);
    console.log(`  ready: ${result.analysis.ready}`);

    if (result.analysis.diagnostics.length > 0) {
      console.log(`  diagnostics:`);
      for (const d of result.analysis.diagnostics) {
        const icon = d.level === "error" ? "E" : d.level === "warn" ? "W" : "I";
        console.log(`    [${icon}] ${d.prefix}: ${d.message}`);
      }
    }

    if (result.analysis.releaseOrder.length > 0) {
      console.log(`  release order: ${result.analysis.releaseOrder.join(" → ")}`);
    }
  }
}
