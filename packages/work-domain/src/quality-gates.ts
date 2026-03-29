/**
 * 품질 게이트 해결 함수
 *
 * Work Domain 분류에 따라 적용할 품질 게이트를 반환하고,
 * prd.json acceptanceCriteria 문자열로 변환한다.
 */

import type { QualityGate, WorkDomainId } from "./types.js";
import { getDomainDef } from "./registry.js";

/**
 * 도메인에 해당하는 품질 게이트 목록 반환.
 *
 * @param domainId - 작업 도메인 ID
 * @param pkg - 대상 패키지명 (게이트 명령의 `<pkg>` 치환용, optional)
 */
export function resolveQualityGates(
  domainId: WorkDomainId,
  pkg?: string,
): readonly QualityGate[] {
  const domain = getDomainDef(domainId);
  if (!pkg) return domain.qualityGates;

  return domain.qualityGates.map((gate) =>
    Object.assign({}, gate, { command: gate.command.replaceAll("<pkg>", pkg) }),
  );
}

/**
 * 품질 게이트 목록을 prd.json acceptanceCriteria 문자열 배열로 변환.
 *
 * 기존 Ralph TUI 포맷과 하위호환을 위해
 * `"{command} passes"` 형태의 문자열을 생성한다.
 */
export function gatesToCriteria(gates: readonly QualityGate[]): string[] {
  return gates.map((g) => `${g.command} passes`);
}

/**
 * 여러 도메인의 품질 게이트를 병합하고 중복 제거.
 *
 * 하나의 유저 스토리가 여러 도메인에 걸칠 때 사용한다.
 * gate.id 기준으로 중복을 제거한다.
 */
export function mergeQualityGates(
  domainIds: readonly WorkDomainId[],
  pkg?: string,
): readonly QualityGate[] {
  const seen = new Set<string>();
  const result: QualityGate[] = [];

  for (const domainId of domainIds) {
    const gates = resolveQualityGates(domainId, pkg);
    for (const gate of gates) {
      if (!seen.has(gate.id)) {
        seen.add(gate.id);
        result.push(gate);
      }
    }
  }

  return result;
}
