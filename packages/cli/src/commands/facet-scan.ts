/**
 * facet-scan — @facet 마커 파싱 + import 의존 분석.
 *
 * @facet 마커가 붙은 파일은 환경 의존 없는 순수 비즈니스 로직으로,
 * 격리된 테스트 인프라에서 동기화하여 테스트할 대상이다.
 */

export interface FacetMarker {
  type: "file";
  exports: string[];
}

const FACET_RE = /@facet(?:\s+export\s+([\w,\s]+))?/;

export function parseFacetMarker(line: string): FacetMarker | null {
  const trimmed = line.replace(/^\s*(?:\/\/\s*|#\s*|\*\s*)/, "").trim();
  const match = trimmed.match(FACET_RE);
  if (!match) return null;

  const exports = match[1]
    ? match[1].split(",").map(s => s.trim()).filter(Boolean)
    : [];

  return { type: "file", exports };
}
