/**
 * migrator 자동 추론.
 *
 * diff 결과에서 일반적 마이그레이션 패턴을 분류하고
 * CoordMigrator 함수를 자동 생성한다.
 */

import type { InferredMigrator, MigratorPattern } from "../dkg.types.js";

export interface DiffInfo {
  readonly fromLabels: readonly string[];
  readonly toLabels: readonly string[];
  readonly changedLabels: readonly {
    readonly label: string;
    readonly fromMax: number;
    readonly toMax: number;
  }[];
}

/**
 * diff 정보에서 migrator를 추론한다.
 *
 * @param diff - 두 버전 간 차이 정보
 * @param options - append-dim 시 기본값 등
 * @returns 추론된 migrator (unknown이면 migrator=null)
 */
export function inferMigrator(
  diff: DiffInfo,
  options?: { defaultValue?: number },
): InferredMigrator {
  const defaultValue = options?.defaultValue ?? 1;
  const fromSet = new Set(diff.fromLabels);
  const toSet = new Set(diff.toLabels);

  // 패턴 1: 같은 labels, 같은 순서 → max만 변경 여부 확인
  if (arraysEqual(diff.fromLabels, diff.toLabels)) {
    const allMaxIncreased = diff.changedLabels.every(c => c.toMax >= c.fromMax);

    if (diff.changedLabels.length === 0 || allMaxIncreased) {
      return {
        pattern: "identity",
        migrator: (coords) => [...coords],
        description: diff.changedLabels.length === 0
          ? "변경 없음. 좌표 동일 유지."
          : "max만 증가. 좌표 동일 유지.",
      };
    }

    // max가 감소한 경우 → unknown (entry 재배치 가능성)
    return {
      pattern: "unknown",
      migrator: null,
      description: "일부 label의 max가 감소. 수동 migrator 필요.",
      warnings: diff.changedLabels
        .filter(c => c.toMax < c.fromMax)
        .map(c => `${c.label}: max ${c.fromMax}→${c.toMax} (감소)`),
    };
  }

  // 패턴 2: 같은 집합, 다른 순서 → reorder (append/remove보다 먼저 검사)
  if (fromSet.size === toSet.size && diff.fromLabels.every(l => toSet.has(l))
      && !arraysEqual(diff.fromLabels, diff.toLabels)) {
    const mapping = diff.toLabels.map(l => diff.fromLabels.indexOf(l));

    return {
      pattern: "reorder",
      migrator: (coords) => mapping.map(i => coords[i]),
      description: `차원 순서 변경: [${diff.fromLabels.join(",")}] → [${diff.toLabels.join(",")}]`,
    };
  }

  // 패턴 3: toLabels ⊃ fromLabels → append-dim
  if (diff.fromLabels.every(l => toSet.has(l))) {
    const addedLabels = diff.toLabels.filter(l => !fromSet.has(l));
    const addedIndices = addedLabels.map(l => diff.toLabels.indexOf(l));

    // fromLabels 순서가 toLabels 내에서 보존되는지 확인
    const fromIndicesInTo = diff.fromLabels.map(l => diff.toLabels.indexOf(l));
    const orderPreserved = fromIndicesInTo.every((v, i) => i === 0 || v > fromIndicesInTo[i - 1]);

    if (orderPreserved) {
      return {
        pattern: "append-dim",
        migrator: (coords) => {
          const result = new Array(diff.toLabels.length);
          let fromIdx = 0;
          for (let i = 0; i < diff.toLabels.length; i++) {
            if (addedIndices.includes(i)) {
              result[i] = defaultValue;
            } else {
              result[i] = coords[fromIdx++];
            }
          }
          return result;
        },
        description: `차원 추가: ${addedLabels.join(", ")}. 기본값 ${defaultValue}.`,
        warnings: [`기본값 ${defaultValue}이 의미적으로 적절한지 확인 필요`],
      };
    }
  }

  // 패턴 3: toLabels ⊂ fromLabels → remove-dim
  if (diff.toLabels.every(l => fromSet.has(l))) {
    const removedLabels = diff.fromLabels.filter(l => !toSet.has(l));
    const keepIndices = diff.toLabels.map(l => diff.fromLabels.indexOf(l));

    return {
      pattern: "remove-dim",
      migrator: (coords) => keepIndices.map(i => coords[i]),
      description: `차원 제거: ${removedLabels.join(", ")}.`,
      warnings: removedLabels.map(l => `${l} 제거됨. 기존 데이터에서 이 차원의 정보 소실`),
    };
  }

  // 패턴 6: 복합 변경 → unknown
  return {
    pattern: "unknown",
    migrator: null,
    description: "복합 변경. 수동 migrator 필요.",
    warnings: [
      `from: [${diff.fromLabels.join(",")}]`,
      `to: [${diff.toLabels.join(",")}]`,
    ],
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
