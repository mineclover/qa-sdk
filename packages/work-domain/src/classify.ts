/**
 * 유저 스토리 자동 분류
 *
 * 유저 스토리의 title + description 텍스트에서
 * 키워드 매칭으로 Work Domain을 추론한다.
 */

import type { ClassificationResult, WorkDomainId } from "./types.js";

// ─── 키워드 사전 ────────────────────────────────────────

interface KeywordEntry {
  readonly domain: WorkDomainId;
  /** 소문자 키워드 (매칭 시 소문자 변환 후 비교) */
  readonly keywords: readonly string[];
}

const KEYWORD_MAP: readonly KeywordEntry[] = [
  {
    domain: "data-infra",
    keywords: [
      "db", "database", "schema", "migration", "table", "column", "index",
      "dto", "enum", "drizzle", "prisma", "sqlite", "postgresql",
      "스키마", "마이그레이션", "테이블", "인덱스", "데이터베이스",
    ],
  },
  {
    domain: "backend-logic",
    keywords: [
      "api", "endpoint", "rest", "graphql", "grpc", "zod", "joi",
      "jwt", "rbac", "auth", "middleware", "controller", "service",
      "supertest", "nestjs", "hono",
      "엔드포인트", "인증", "인가", "미들웨어", "권한",
    ],
  },
  {
    domain: "ui-component",
    keywords: [
      "component", "widget", "button", "modal", "dialog", "form",
      "input", "select", "checkbox", "radio", "tooltip", "dropdown",
      "style", "theme", "css", "tailwind", "storybook",
      "컴포넌트", "스타일", "테마",
    ],
  },
  {
    domain: "frontend-app",
    keywords: [
      "route", "router", "page", "view", "layout", "navigation",
      "ssr", "csr", "hydration", "viewport", "responsive",
      "playwright", "cypress", "lighthouse", "vite",
      "라우팅", "페이지", "레이아웃", "반응형",
    ],
  },
  {
    domain: "ai-engineering",
    keywords: [
      "rag", "embedding", "vector", "llm", "gpt", "claude", "prompt",
      "few-shot", "chain-of-thought", "retrieval", "chunking",
      "langchain", "token", "inference", "fine-tune",
      "임베딩", "프롬프트", "청킹", "검색",
    ],
  },
  {
    domain: "observability",
    keywords: [
      "metric", "trace", "span", "log", "logging", "alert", "alarm",
      "slo", "sli", "sla", "dashboard", "grafana", "prometheus",
      "opentelemetry", "otel", "golden-signal",
      "메트릭", "트레이싱", "경보", "모니터링",
    ],
  },
  {
    domain: "global-inclusion",
    keywords: [
      "i18n", "l10n", "locale", "rtl", "ltr", "translation",
      "aria", "a11y", "wcag", "screen-reader", "alt-text",
      "contrast", "focus-visible", "keyboard-nav",
      "국제화", "접근성", "번역", "명암", "대체 텍스트",
    ],
  },
  {
    domain: "security-guardrail",
    keywords: [
      "security", "injection", "xss", "csrf", "pii", "masking",
      "sanitize", "escape", "cve", "audit", "vulnerability",
      "helmet", "cors", "csp", "rate-limit",
      "보안", "주입", "마스킹", "취약점",
    ],
  },
  {
    domain: "productivity",
    keywords: [
      "refactor", "dead-code", "complexity", "lint", "deprecate",
      "seo", "sitemap", "analytics", "tracking-event",
      "migration-guide", "version-bump", "changelog",
      "리팩터링", "복잡도", "사장 코드", "분석",
    ],
  },
  {
    domain: "tech-docs",
    keywords: [
      "swagger", "openapi", "readme", "documentation", "diagram",
      "mermaid", "jsdoc", "typedoc", "architecture-doc",
      "adr", "rfc", "spec-doc",
      "문서", "다이어그램", "아키텍처", "가이드",
    ],
  },
];

// ─── 분류 함수 ──────────────────────────────────────────

/**
 * 유저 스토리 텍스트에서 Work Domain을 추론한다.
 *
 * 키워드 매칭 기반. title과 description을 합쳐서
 * 각 도메인 키워드와의 일치 수를 세고 가장 높은 도메인을 반환.
 *
 * confidence = matchCount / totalKeywords (해당 도메인).
 * 매칭되는 키워드가 없으면 "backend-logic" (가장 일반적) 을 fallback으로 반환.
 */
export function classifyUserStory(story: {
  readonly title: string;
  readonly description: string;
}): ClassificationResult {
  const text = `${story.title} ${story.description}`.toLowerCase();

  let bestDomain: WorkDomainId = "backend-logic";
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const entry of KEYWORD_MAP) {
    const matched: string[] = [];
    for (const kw of entry.keywords) {
      if (text.includes(kw)) {
        matched.push(kw);
      }
    }
    const score = matched.length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = entry.domain;
      bestSignals = matched;
    }
  }

  const totalKeywords = KEYWORD_MAP.find((e) => e.domain === bestDomain)?.keywords.length ?? 1;
  const confidence = bestScore === 0 ? 0 : Math.min(bestScore / totalKeywords, 1);

  return {
    domain: bestDomain,
    confidence: Math.round(confidence * 100) / 100,
    signals: bestSignals,
  };
}

/**
 * 여러 유저 스토리를 일괄 분류한다.
 */
export function classifyStories(
  stories: readonly { readonly title: string; readonly description: string }[],
): readonly ClassificationResult[] {
  return stories.map(classifyUserStory);
}
