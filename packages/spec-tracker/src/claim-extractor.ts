import type { ContractMarkerKind } from "./types.js";
import type { VerificationClaim } from "./verification-claim.js";

/**
 * definition-catalog ContractSection과 구조적으로 호환되는 최소 입력.
 *
 * spec-tracker는 definition-catalog에 직접 의존하지 않고도
 * marker 섹션에서 claim atom을 추출할 수 있어야 한다.
 */
export interface ClaimSectionInput {
  readonly specId: string;
  readonly subjectRef: string;
  readonly marker: ContractMarkerKind;
  readonly sourceId: string;
  readonly body: string;
}

/**
 * marker 섹션 하나에서 추출된 claim.
 */
export interface ExtractedClaim extends VerificationClaim {
  readonly sourceId: string;
}

export function extractClaimsFromSection(
  input: ClaimSectionInput,
): readonly ExtractedClaim[] {
  const units = extractClaimUnits(input.body);
  return units.map((text, index) => ({
    claimId: buildClaimId(input, index, text),
    specId: input.specId,
    subjectRef: input.subjectRef,
    marker: input.marker,
    text,
    sourceId: input.sourceId,
  }));
}

export function extractClaimsFromSections(
  inputs: readonly ClaimSectionInput[],
): readonly ExtractedClaim[] {
  return inputs.flatMap((input) => extractClaimsFromSection(input));
}

/**
 * claim 단위 추출 규칙
 *
 * 1. bullet/numbered list가 있으면 각 항목이 claim 1건
 * 2. 없으면 paragraph 단위
 * 3. 빈 줄/장식 줄은 제거
 */
export function extractClaimUnits(body: string): readonly string[] {
  const bulletUnits = body
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.match(/^([-*]|\d+\.)\s+(.+)$/)?.[2]?.trim() ?? null)
    .filter((line): line is string => Boolean(line))
    .map(normalizeClaimText)
    .filter((line) => line.length > 0);

  if (bulletUnits.length > 0) {
    return bulletUnits;
  }

  return body
    .split(/\n\s*\n/g)
    .map((part) => normalizeClaimText(part))
    .filter((part) => part.length > 0);
}

function buildClaimId(
  input: ClaimSectionInput,
  index: number,
  text: string,
): string {
  const slug = slugify(text).slice(0, 40) || "claim";
  return [
    input.specId,
    input.sourceId,
    input.marker,
    String(index + 1).padStart(2, "0"),
    slug,
  ].join(":");
}

function normalizeClaimText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[.:;,\-–—\s]+|[.:;,\-–—\s]+$/g, "")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
