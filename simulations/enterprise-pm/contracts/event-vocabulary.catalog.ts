// event-vocabulary.catalog — outbox event name 어휘 사전.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md §2.5
// 본 파일은 sim-identifier-grammar 의 event-name builder/parser 가 import 하는 SSOT 이다.
// 실제 운영 어휘 확장은 Task 2.17 에서 PR 단위로 추가한다 (skeleton 단계의 minimum 어휘).

export const EVENT_DOMAINS = ["approval", "pm"] as const;
export type EventDomain = (typeof EVENT_DOMAINS)[number];

// domain 별 허용 aggregate. domain × aggregate 매트릭스를 직교로 등록한다.
export const EVENT_AGGREGATES_BY_DOMAIN: {
  readonly [D in EventDomain]: readonly string[];
} = {
  approval: ["budget", "request"],
  pm: ["task", "project"],
} as const;

export const EVENT_VERBS_PAST = ["submitted", "approved", "rejected", "completed"] as const;
export type EventVerbPast = (typeof EVENT_VERBS_PAST)[number];
