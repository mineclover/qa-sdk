import { describe, it, expect } from "vitest";
import { findMarkers, extractByLevel, summarizeDocument } from "./extract.js";

const SAMPLE_BODY = `# Gate Service API 계약

> RPC 엔드포인트 명세. 요청/응답 스키마, 에러 코드, 인증 요구만 기술한다. ^purpose

## 엔드포인트 ^overview

### POST /gate/check

주소의 encode/decode 가능 여부를 반환한다.

\`\`\`
요청: { prefix: string, versionId: string, address: number }
응답: { allowed: boolean, state: AddressState }
\`\`\`

### POST /gate/classify

주소의 상태를 분류한다.

## 에러 코드 ^overview

| 코드 | 의미 |
|------|------|
| NOT_FOUND | prefix 미등록 |
| NOT_COMPUTED | recompute 미실행 |

## 인증

모든 엔드포인트는 서비스 간 내부 호출 전용.`;

describe("findMarkers", () => {
  it("^purpose와 ^overview를 찾는다", () => {
    const markers = findMarkers(SAMPLE_BODY);
    expect(markers.length).toBe(3);
    expect(markers[0].marker).toBe("purpose");
    expect(markers[1].marker).toBe("overview");
    expect(markers[2].marker).toBe("overview");
  });

  it("마커가 제거된 텍스트를 반환한다", () => {
    const markers = findMarkers(SAMPLE_BODY);
    expect(markers[0].text).toBe("> RPC 엔드포인트 명세. 요청/응답 스키마, 에러 코드, 인증 요구만 기술한다.");
    expect(markers[1].text).toBe("## 엔드포인트");
    expect(markers[2].text).toBe("## 에러 코드");
  });

  it("마커 없는 문서는 빈 배열", () => {
    expect(findMarkers("# 제목\n\n본문")).toEqual([]);
  });
});

describe("extractByLevel", () => {
  it("purpose: ^purpose 줄만 추출", () => {
    const result = extractByLevel(SAMPLE_BODY, "purpose");
    expect(result.lines.length).toBe(1);
    expect(result.text).toContain("RPC 엔드포인트 명세");
    // purpose에는 ^overview 마킹된 "## 엔드포인트" 섹션 제목이 포함되지 않음
    expect(result.text).not.toContain("## 엔드포인트");
    expect(result.noMarkers).toBe(false);
  });

  it("overview: ^purpose + ^overview 줄 추출", () => {
    const result = extractByLevel(SAMPLE_BODY, "overview");
    expect(result.lines.length).toBe(3);
    expect(result.text).toContain("RPC 엔드포인트 명세");
    expect(result.text).toContain("## 엔드포인트");
    expect(result.text).toContain("## 에러 코드");
  });

  it("full: 전체 반환 (마커만 제거)", () => {
    const result = extractByLevel(SAMPLE_BODY, "full");
    expect(result.text).toContain("POST /gate/check");
    expect(result.text).toContain("인증");
    // 마커 제거 확인
    expect(result.text).not.toContain("^purpose");
    expect(result.text).not.toContain("^overview");
  });

  it("마커 없는 문서에서 purpose → 빈 결과 + noMarkers=true", () => {
    const result = extractByLevel("# 제목\n본문", "purpose");
    expect(result.text).toBe("");
    expect(result.noMarkers).toBe(true);
  });
});

describe("summarizeDocument", () => {
  it("문서 요약을 추출한다", () => {
    const summary = summarizeDocument(
      "gate-api", "interface", "api_contract", "specification",
      "Gate Service API 계약", SAMPLE_BODY,
    );
    expect(summary.purpose).toContain("RPC 엔드포인트 명세");
    expect(summary.overview.length).toBe(2);
    expect(summary.overview).toContain("## 엔드포인트");
    expect(summary.overview).toContain("## 에러 코드");
  });

  it("마커 없으면 purpose=null, overview=[]", () => {
    const summary = summarizeDocument(
      "no-markers", "feature", "func_def", "specification",
      "마커 없는 문서", "# 제목\n본문",
    );
    expect(summary.purpose).toBeNull();
    expect(summary.overview).toEqual([]);
  });
});

describe("실제 사용 시나리오: 여러 문서의 purpose만 모아보기", () => {
  const docs = [
    { id: "gate-api", scope: "interface", aspect: "api_contract", depth: "specification",
      title: "Gate Service API 계약",
      body: "> RPC 엔드포인트 명세. ^purpose\n## 엔드포인트 ^overview" },
    { id: "gate-state", scope: "state", aspect: "domain_state", depth: "specification",
      title: "Gate 4-State 모델",
      body: "> 주소 공간의 active/inactive/open/reserved 상태 모델. ^purpose\n## 상태 정의 ^overview" },
    { id: "gate-func", scope: "feature", aspect: "func_def", depth: "specification",
      title: "GateEngine 기능 명세",
      body: "> 주소 상태 자동 계산 엔진. ^purpose\n## 핵심 기능 ^overview" },
    { id: "gate-flow", scope: "flow", aspect: "process_flow", depth: "specification",
      title: "Gate 운영 흐름",
      body: "> encode/recompute/query 경로별 처리 순서. ^purpose\n## 흐름 1 ^overview" },
    { id: "gate-constraint", scope: "constraint", aspect: "tech_constraint", depth: "specification",
      title: "Gate 기술적 제약",
      body: "> fail-open, 읽기 전용 캐시, composite AND 불변 조건. ^purpose" },
    { id: "gate-scenario", scope: "feature", aspect: "scenario", depth: "validation",
      title: "Gate 테스트 시나리오",
      body: "> 정상 encode, inactive dim, cascade, fail-open 검증. ^purpose" },
  ];

  it("purpose만 모아보기", () => {
    const purposes = docs.map(d => ({
      id: d.id,
      scope: d.scope,
      purpose: extractByLevel(d.body, "purpose").text,
    }));

    expect(purposes.length).toBe(6);
    for (const p of purposes) {
      expect(p.purpose.length).toBeGreaterThan(0);
    }
    expect(purposes.find(p => p.id === "gate-api")!.purpose).toContain("RPC 엔드포인트");
    expect(purposes.find(p => p.id === "gate-constraint")!.purpose).toContain("fail-open");
  });

  it("constraint, state 제외하고 purpose만", () => {
    const filtered = docs
      .filter(d => d.scope !== "constraint" && d.scope !== "state")
      .map(d => ({
        id: d.id,
        purpose: extractByLevel(d.body, "purpose").text,
      }));

    expect(filtered.length).toBe(4);
    expect(filtered.map(f => f.id).sort()).toEqual([
      "gate-api", "gate-flow", "gate-func", "gate-scenario",
    ]);
  });

  it("overview로 보면 섹션 제목도 포함", () => {
    const overviews = docs.map(d => ({
      id: d.id,
      overview: extractByLevel(d.body, "overview").lines,
    }));

    const apiOverview = overviews.find(o => o.id === "gate-api")!;
    expect(apiOverview.overview.length).toBe(2); // purpose + "## 엔드포인트"
  });
});
