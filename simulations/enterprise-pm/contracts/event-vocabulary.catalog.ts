// outbox event name builder(#5) + schemaHash(#6)가 참조하는 도메인/aggregate/verb 사전.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md §2.5, §6
// 본 파일은 sim-identifier-grammar 의 event-name builder/parser 가 import 하는 SSOT 이다.
export const SIM_EVENT_VOCABULARY = {
  domains: ['approval', 'auth', 'pm', 'document', 'notification'] as const,
  aggregates: {
    approval: ['budget', 'resource', 'expense', 'time-off'] as const,
    auth: ['user', 'role', 'role-assignment', 'department', 'bitmap'] as const,
    pm: ['project', 'task', 'member', 'assignment'] as const,
    document: ['document', 'comment', 'version'] as const,
    notification: ['notification', 'subscription'] as const,
  },
  // 도메인 verb 어휘.
  // - approval/document: submitted/approved/rejected/revised/cancelled/completed/issued
  // - auth: created/updated/deleted (user/role/department) + assigned/revoked (role-assignment)
  verbsPast: [
    'submitted',
    'approved',
    'rejected',
    'revised',
    'cancelled',
    'completed',
    'issued',
    'created',
    'updated',
    'deleted',
    'assigned',
    'revoked',
  ] as const,
} as const;

// ──────────────────────────────────────────────────────────────────────
// 하위 호환 named exports (group 1 skeleton 단계에서 builder/test 가 직접 import).
// SSOT 는 SIM_EVENT_VOCABULARY 이며, 본 export 들은 거기서 파생된다.
// ──────────────────────────────────────────────────────────────────────

export const EVENT_DOMAINS = SIM_EVENT_VOCABULARY.domains;
export type EventDomain = (typeof EVENT_DOMAINS)[number];

export const EVENT_AGGREGATES_BY_DOMAIN: {
  readonly [D in EventDomain]: readonly string[];
} = SIM_EVENT_VOCABULARY.aggregates;

export const EVENT_VERBS_PAST = SIM_EVENT_VOCABULARY.verbsPast;
export type EventVerbPast = (typeof EVENT_VERBS_PAST)[number];
