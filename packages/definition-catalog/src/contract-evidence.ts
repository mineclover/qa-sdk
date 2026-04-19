// @def.doc definition-catalog-spec

/**
 * 계약 증거 파싱 — [reversible]/[irreversible] 어노테이션 추출.
 *
 * contract.ts에서 추출 — 정규식 기반 파싱, 의존 없음.
 */

/**
 * 관측 가역성.
 * reversible: 원본 데이터 복원 가능 (이벤트 소싱, raw event log)
 * irreversible: 정보 손실로 원본 복원 불가 (집계 메트릭, verdict 판정)
 */
export type Reversibility = "reversible" | "irreversible";

/** 파싱된 증거 항목 */
export interface EvidenceItem {
  readonly description: string;
  readonly reversibility: Reversibility | null;
  readonly sourceId: string;
  readonly raw: string;
}

const REVERSIBILITY_REGEX = /\s*\[(reversible|irreversible)\]\s*$/;

/**
 * evidence 섹션 본문에서 증거 항목을 파싱한다.
 * 불릿 항목(-/*)에서 [reversible]/[irreversible] 어노테이션을 추출한다.
 */
export function parseEvidenceItems(body: string, sourceId: string): readonly EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const line of body.split("\n")) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (!bulletMatch) continue;

    const raw = bulletMatch[1].trim();
    const revMatch = raw.match(REVERSIBILITY_REGEX);

    if (revMatch) {
      items.push({
        description: raw.replace(REVERSIBILITY_REGEX, "").trim(),
        reversibility: revMatch[1] as Reversibility,
        sourceId,
        raw,
      });
    } else {
      items.push({
        description: raw,
        reversibility: null,
        sourceId,
        raw,
      });
    }
  }
  return items;
}
