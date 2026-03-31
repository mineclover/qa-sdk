import { describe, it, expect } from "vitest";
import { findMarkedSections, findMarkers, extractByLevel, extractByMarker, summarizeDocument } from "./extract.js";

const SAMPLE_BODY = `# Gate Service API 계약

## 목적 ^purpose

RPC 엔드포인트 명세. 요청/응답 스키마, 에러 코드, 인증 요구를 정의한다.
모든 호출은 서비스 간 내부 전용이며 외부 노출을 금지한다.

## 구성 ^overview

6개 RPC: check, classify, getState, recompute, cascadeRecompute, filterRanges.
에러 코드: NOT_FOUND, NOT_COMPUTED, STALE_CACHE 3종.

## 엔드포인트

### POST /gate/check

주소의 encode/decode 가능 여부를 반환한다.

## 인증

모든 엔드포인트는 서비스 간 내부 호출 전용.`;

describe("findMarkedSections", () => {
  it("^purpose와 ^overview 섹션을 찾는다", () => {
    const sections = findMarkedSections(SAMPLE_BODY);
    expect(sections.length).toBe(2);
    expect(sections[0].marker).toBe("purpose");
    expect(sections[1].marker).toBe("overview");
  });

  it("섹션 본문이 다음 동급 헤더 전까지 수집된다", () => {
    const sections = findMarkedSections(SAMPLE_BODY);
    const purpose = sections[0];
    expect(purpose.body).toContain("RPC 엔드포인트 명세");
    expect(purpose.body).toContain("외부 노출을 금지한다");
    // 다음 섹션 내용은 포함하지 않음
    expect(purpose.body).not.toContain("6개 RPC");
  });

  it("헤더 레벨이 올바르다", () => {
    const sections = findMarkedSections(SAMPLE_BODY);
    expect(sections[0].level).toBe(2); // ##
    expect(sections[1].level).toBe(2);
  });

  it("마커 없는 문서는 빈 배열", () => {
    expect(findMarkedSections("# 제목\n\n본문")).toEqual([]);
  });
});

describe("findMarkers (하위 호환)", () => {
  it("줄 단위로도 찾는다", () => {
    const markers = findMarkers(SAMPLE_BODY);
    expect(markers.length).toBe(2);
    expect(markers[0].marker).toBe("purpose");
  });
});

describe("extractByLevel", () => {
  it("purpose: ^purpose 섹션 본문만", () => {
    const result = extractByLevel(SAMPLE_BODY, "purpose");
    expect(result.text).toContain("RPC 엔드포인트 명세");
    expect(result.text).toContain("외부 노출을 금지한다");
    expect(result.text).not.toContain("6개 RPC");
    expect(result.noMarkers).toBe(false);
  });

  it("overview: ^purpose + ^overview 섹션 본문", () => {
    const result = extractByLevel(SAMPLE_BODY, "overview");
    expect(result.text).toContain("RPC 엔드포인트 명세");
    expect(result.text).toContain("6개 RPC");
    expect(result.text).toContain("NOT_FOUND");
    // detail 내용은 포함하지 않음
    expect(result.text).not.toContain("POST /gate/check");
  });

  it("full: 전체 반환 (마커만 제거)", () => {
    const result = extractByLevel(SAMPLE_BODY, "full");
    expect(result.text).toContain("POST /gate/check");
    expect(result.text).toContain("인증");
    expect(result.text).not.toContain("^purpose");
    expect(result.text).not.toContain("^overview");
  });

  it("마커 없는 문서에서 purpose → 빈 결과", () => {
    const result = extractByLevel("# 제목\n본문", "purpose");
    expect(result.text).toBe("");
    expect(result.noMarkers).toBe(true);
  });

  it("fenced code block 안의 예시 마커는 무시한다", () => {
    const body = `# 가이드

## 목적 ^purpose

실제 목적 문장.

## 예시

\`\`\`markdown
## 목적 ^purpose
예시 문장.
\`\`\`
`;

    const result = extractByLevel(body, "purpose");
    expect(result.text).toContain("실제 목적 문장.");
    expect(result.text).not.toContain("예시 문장.");
  });
});

describe("summarizeDocument", () => {
  it("헤더 섹션에서 요약을 추출한다", () => {
    const summary = summarizeDocument(
      "gate-api", "interface", "api_contract", "specification",
      "Gate Service API 계약", SAMPLE_BODY,
    );
    expect(summary.purpose).toContain("RPC 엔드포인트 명세");
    expect(summary.purpose).toContain("외부 노출을 금지한다");
    expect(summary.overview.length).toBe(1);
    expect(summary.overview[0]).toContain("6개 RPC");
  });

  it("마커 없으면 purpose=null", () => {
    const summary = summarizeDocument(
      "no-markers", "feature", "func_def", "specification",
      "마커 없는 문서", "# 제목\n본문",
    );
    expect(summary.purpose).toBeNull();
    expect(summary.overview).toEqual([]);
  });
});

describe("레거시 호환: 줄 단위 마커", () => {
  const LEGACY = `# 제목

> 이것은 목적입니다. ^purpose

본문 내용`;

  it("줄 단위 마커도 섹션으로 수집된다 (본문 = 줄 자체)", () => {
    const sections = findMarkedSections(LEGACY);
    expect(sections.length).toBe(1);
    expect(sections[0].body).toContain("이것은 목적입니다");
  });
});

describe("여러 문서의 purpose 모아보기", () => {
  const docs = [
    { id: "gate-api", scope: "interface",
      body: "# API\n\n## 목적 ^purpose\n\nRPC 엔드포인트 명세.\n\n## 구성 ^overview\n\n6개 RPC." },
    { id: "gate-state", scope: "state",
      body: "# State\n\n## 목적 ^purpose\n\n4-state 모델.\n활성/비활성/열림/예약." },
    { id: "gate-constraint", scope: "constraint",
      body: "# Constraint\n\n## 목적 ^purpose\n\nfail-open 등 불변 조건." },
  ];

  it("purpose만 모으면 섹션 분량의 요약이 된다", () => {
    const purposes = docs.map(d => ({
      id: d.id,
      scope: d.scope,
      purpose: extractByLevel(d.body, "purpose").text,
    }));

    expect(purposes.length).toBe(3);
    expect(purposes[0].purpose).toContain("RPC 엔드포인트");
    expect(purposes[1].purpose).toContain("4-state");
    expect(purposes[1].purpose).toContain("활성/비활성"); // 여러 줄 수집됨
    expect(purposes[2].purpose).toContain("fail-open");
  });

  it("constraint 제외하고 purpose만", () => {
    const filtered = docs
      .filter(d => d.scope !== "constraint")
      .map(d => ({ id: d.id, purpose: extractByLevel(d.body, "purpose").text }));
    expect(filtered.length).toBe(2);
  });
});

describe("자유 마커 (extractByMarker)", () => {
  const CONSTRAINT_DOC = `# Gate 제약

## 목적 ^purpose

gate 불변 조건.

## 불변 조건 ^constraint

1. Fail-open: gate check 실패 시 허용.
2. Composite AND: 어느 dim이라도 차단이면 전체 차단.

## 보안 제약 ^constraint

- 내부 호출 전용
- flag 변경은 관리자 API만

## 성능 제약

- checkGate < 5ms
`;

  it("^constraint 마커 섹션만 추출", () => {
    const result = extractByMarker(CONSTRAINT_DOC, "constraint");
    expect(result.sections.length).toBe(2);
    expect(result.text).toContain("Fail-open");
    expect(result.text).toContain("내부 호출 전용");
    // purpose와 성능 제약은 포함하지 않음
    expect(result.text).not.toContain("gate 불변 조건");
    expect(result.text).not.toContain("checkGate");
  });

  const STATE_DOC = `# Gate 상태 모델

## 목적 ^purpose

4-state 모델.

## 상태 정의 ^state-def

active, inactive, open, reserved

## 전이 규칙 ^state-def

active ↔ inactive (flag/release)
`;

  it("^state-def 마커 섹션만 추출", () => {
    const result = extractByMarker(STATE_DOC, "state-def");
    expect(result.sections.length).toBe(2);
    expect(result.text).toContain("active, inactive, open, reserved");
    expect(result.text).toContain("active ↔ inactive");
    expect(result.text).not.toContain("4-state 모델");
  });

  it("여러 마커를 동시에 추출", () => {
    const result = extractByMarker(CONSTRAINT_DOC, "purpose", "constraint");
    expect(result.sections.length).toBe(3); // purpose 1 + constraint 2
    expect(result.text).toContain("gate 불변 조건");
    expect(result.text).toContain("Fail-open");
  });

  it("존재하지 않는 마커는 빈 결과", () => {
    const result = extractByMarker(CONSTRAINT_DOC, "nonexistent");
    expect(result.sections.length).toBe(0);
    expect(result.text).toBe("");
  });
});
