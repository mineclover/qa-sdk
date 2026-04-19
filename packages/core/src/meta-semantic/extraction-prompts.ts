// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Extraction LLM 프롬프트 — 4종 판단 템플릿.
 *
 * 실제 LLM 호출은 ExtractionPort 구현체에서.
 * 이 파일은 프롬프트 구성 + mock 구현만 제공.
 */

import type { ExtractionPort, LlmJudgmentRequest, LlmJudgmentResponse } from "./extraction.js";

// ── 프롬프트 템플릿 ───────────────────────────────────

export const PROMPT_TEMPLATES = {
  testability: `다음 함수가 독립적으로 테스트 가능한 실행 단위인지 판단하세요.

판단 기준:
- 명확한 입력/출력 타입이 있는가
- 부수효과가 식별 가능한가 (또는 없는가)
- 다른 함수와 독립적으로 테스트할 수 있는가

제외 기준:
- 내부 헬퍼로만 사용되고 외부 계약이 없는 함수
- 단순 getter/setter
- 타입 가드 (is 키워드)

코드:
{codeSnippet}

{markers}

JSON으로 응답:
{ "verdict": boolean, "confidence": 0~1, "reasoning": "판단 근거", "extracted": { "sideEffects": ["목록"] } }`,

  "branch-significance": `다음 분기가 비즈니스적으로 의미 있는 경우의 수인지 판단하세요.

의미 있는 분기:
- 비즈니스 로직이 다르게 동작 (if paymentType === 'card')
- 다른 부수효과 유발 (경로에 따라 다른 API 호출)

의미 없는 분기 (제외):
- 에러 처리 (try/catch)
- null/undefined 체크
- 로깅/디버깅 분기
- 타입 가드

분기 정보:
{codeSnippet}

JSON으로 응답:
{ "verdict": boolean, "confidence": 0~1, "reasoning": "판단 근거" }`,

  "side-effects": `다음 코드에서 외부 상태를 변경하는 부수효과를 식별하세요.

부수효과 예시:
- DB 쓰기/삭제
- HTTP 요청 전송
- 파일 시스템 변경
- 이벤트 발행
- 전역 상태 변경

코드:
{codeSnippet}

JSON으로 응답:
{ "verdict": true, "confidence": 0~1, "reasoning": "", "extracted": { "sideEffects": ["목록"] } }`,

  "dependency-importance": `다음 의존이 이 함수의 핵심 의존인지 판단하세요.

핵심 의존: 이 함수의 주요 동작에 필수적인 것
부차 의존: 로깅, 모니터링, 캐시 등 제거해도 핵심 동작에 영향 없는 것

코드:
{codeSnippet}

JSON으로 응답:
{ "verdict": boolean, "confidence": 0~1, "reasoning": "판단 근거" }`,
} as const;

/** 프롬프트 빌드 */
export function buildPrompt(request: LlmJudgmentRequest): string {
  const template = PROMPT_TEMPLATES[request.kind];
  let prompt = template.replace("{codeSnippet}", request.codeSnippet);
  if (request.context?.markers) {
    prompt = prompt.replace("{markers}", `마커 힌트:\n${(request.context.markers as string[]).join("\n")}`);
  } else {
    prompt = prompt.replace("{markers}", "");
  }
  return prompt;
}

// ── Mock LLM 구현 (테스트용) ──────────────────────────

/**
 * 규칙 기반 mock LLM — LLM 없이 파이프라인 테스트 가능.
 *
 * 판단 규칙:
 * - testability: 파라미터 있고 void가 아니면 testable
 * - branch-significance: branchCount >= 2이고 null 체크가 아니면 significant
 * - side-effects: 코드에 fetch/write/emit/send가 포함되면 있음
 * - dependency-importance: import 없으면 중요하지 않음
 */
export function createMockLlm(): ExtractionPort {
  return {
    async judge(request: LlmJudgmentRequest): Promise<LlmJudgmentResponse> {
      switch (request.kind) {
        case "testability": {
          const hasParams = (request.context?.paramCount as number) > 0;
          const hasReturn = request.context?.hasReturn === true;
          const hasMarker = (request.context?.markers as string[] | undefined)?.some(
            m => m.startsWith("intent:"),
          );
          const verdict = (hasParams && hasReturn) || !!hasMarker;
          const sideEffects: string[] = [];
          if (/\bfetch\b/.test(request.codeSnippet)) sideEffects.push("http-request");
          if (/\.emit\b/.test(request.codeSnippet)) sideEffects.push("event-emit");
          if (/writeFile|\.save\b/.test(request.codeSnippet)) sideEffects.push("file-write");
          return { verdict, confidence: verdict ? 0.8 : 0.3, reasoning: "mock rule", extracted: { sideEffects } };
        }

        case "branch-significance": {
          const count = (request.context?.branchCount as number) ?? 0;
          const isNullCheck = /== ?null|!= ?null|\?\?|typeof.*undefined/.test(request.codeSnippet);
          const isErrorHandler = /try|catch|throw/.test(request.codeSnippet);
          const verdict = count >= 2 && !isNullCheck && !isErrorHandler;
          return { verdict, confidence: verdict ? 0.7 : 0.2, reasoning: "mock rule" };
        }

        case "side-effects": {
          const sideEffects: string[] = [];
          if (/\bfetch\b/.test(request.codeSnippet)) sideEffects.push("http-request");
          if (/\.emit\b/.test(request.codeSnippet)) sideEffects.push("event-emit");
          if (/\.query\b|\.execute\b/.test(request.codeSnippet)) sideEffects.push("db-query");
          return { verdict: sideEffects.length > 0, confidence: 0.7, reasoning: "mock rule", extracted: { sideEffects } };
        }

        case "dependency-importance": {
          return { verdict: true, confidence: 0.5, reasoning: "mock: always important" };
        }
      }
    },
  };
}
