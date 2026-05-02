// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildDeterministicLabelInventory } from "deterministic-label-registry";

import { createDeterministicLabelInventoryAdapters } from "./deterministic-label-inventory-adapters.js";

/**
 * Stability PRD US-005 + US-006 — live inventory 재실행 결정론 + 성능 budget.
 *
 * 커밋된 snapshot fixture를 사용하지 않는다. 대신 같은 실행 세션 안에서 2회
 * 돌린 결과가 byte-identical 임을 단언한다. 역사 기록은 git이 소유하며, 본
 * 테스트는 "지금 코드 + 현재 repo state → 결정론적 출력" 만 증명한다.
 */

const PERFORMANCE_BUDGET_MS = 5000;

describe("deterministic-label inventory — live rerun determinism", () => {
  it("produces byte-identical JSON across two consecutive live runs", async () => {
    const repoRoot = resolveRepoRoot();
    const options = {
      rootDir: repoRoot,
      adapters: createDeterministicLabelInventoryAdapters({ rootDir: repoRoot }),
      detectCompletedRecords: true,
      computeReadiness: true,
    };

    const first = await buildDeterministicLabelInventory(options);
    const second = await buildDeterministicLabelInventory(options);

    const firstJson = JSON.stringify(first, null, 2);
    const secondJson = JSON.stringify(second, null, 2);

    if (firstJson !== secondJson) {
      throw new Error(
        "Inventory output is NOT byte-identical on immediate rerun. " +
          "This indicates hidden non-determinism (random order, wall time, env dependency). " +
          "Investigate the projection pipeline with `scripts/stability-exploration.ts`.",
      );
    }

    expect(firstJson).toBe(secondJson);
    expect(first.records.length).toBe(second.records.length);
    expect(first.diagnostics.length).toBe(second.diagnostics.length);
  });

  it("finishes a real-repo inventory within the stability performance budget", async () => {
    const repoRoot = resolveRepoRoot();
    const start = performance.now();
    await buildDeterministicLabelInventory({
      rootDir: repoRoot,
      adapters: createDeterministicLabelInventoryAdapters({ rootDir: repoRoot }),
      detectCompletedRecords: true,
      computeReadiness: true,
    });
    const elapsedMs = performance.now() - start;

    console.log(`[stability] inventory elapsed: ${Math.round(elapsedMs)} ms`);
    expect(elapsedMs).toBeLessThan(PERFORMANCE_BUDGET_MS);
  });
});

function resolveRepoRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, "../../../..");
}
