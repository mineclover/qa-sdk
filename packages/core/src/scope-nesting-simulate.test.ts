/**
 * Scope Nesting + PipeSpec 시뮬레이션 통합 테스트
 *
 * context-action 패턴을 두 레이어로 검증:
 * 1) scope-nesting: 계약 하향 정합성 (정적 구조)
 * 2) simulate: handlers 계층 내부 경로 (동적 흐름)
 */

import { describe, it, expect } from "vitest";
import {
  validateScopeNesting,
  checkSwapSafety,
  type ScopeNesting,
} from "./scope-nesting.js";
import { simulate, matchHappyPath } from "./pipe/pipe-simulate.js";
import type { PipeGraph, PipeSpec, PipeFlow } from "./types/pipe-spec.js";

// ── helpers ──────────────────────────────────────────

const step = (facet: string, eventKey?: string): PipeFlow => ({
  kind: "step" as const,
  facet,
  ...(eventKey != null ? { eventKey } : {}),
});

// ── context-action nesting fixture ───────────────────

/** Vite+ playbook provider stack — 정상 순서 */
const playbookNesting: ScopeNesting = {
  nestingId: "viteplus-playbook",
  scopes: [
    {
      scopeId: "qa-bridge",
      provides: [
        { contractId: "logging-session", type: "logging", shape: "QaBridgeFacade" },
      ],
      consumes: [],
      facets: ["소비"],
    },
    {
      scopeId: "feature-context",
      provides: [
        { contractId: "playbook-state", type: "state", shape: "PlaybookState" },
        { contractId: "persist-adapter", type: "persist" },
      ],
      consumes: [
        { contractId: "logging-session", type: "logging" },
      ],
      facets: ["정의", "저장"],
    },
    {
      scopeId: "handlers",
      provides: [
        { contractId: "submission-handlers", type: "adapter" },
      ],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "logging-session", type: "logging" },
      ],
      facets: ["소비", "관리", "생산"],
    },
    {
      scopeId: "view",
      provides: [],
      consumes: [
        { contractId: "playbook-state", type: "state" },
        { contractId: "submission-handlers", type: "adapter" },
      ],
      facets: ["소비"],
    },
  ],
};

// ── handlers PipeGraph fixture ───────────────────────

/** canonical-review handler 흐름 — 소비→관리→생산 transformer */
const validatePipe: PipeSpec = {
  pipeId: "validate-input",
  version: "v1",
  trigger: { eventKey: "form_submit" },
  flow: {
    kind: "sequence",
    steps: [
      step("소비", "canonical_review_input"),
      step("관리"),
    ],
  },
  produces: ["validation_result"],
};

const computeResultPipe: PipeSpec = {
  pipeId: "compute-result",
  version: "v1",
  trigger: { eventKey: "validation_result" },
  flow: {
    kind: "sequence",
    steps: [
      step("소비"),
      step("생산", "canonical_review_score"),
    ],
  },
  produces: ["review_complete"],
};

const logEventPipe: PipeSpec = {
  pipeId: "log-event",
  version: "v1",
  trigger: { eventKey: "review_complete" },
  flow: {
    kind: "tap",
    observe: step("소비", "canonical_review_logged"),
    step: step("소비"),
  },
};

const handlerGraph: PipeGraph = {
  graphId: "canonical-review-handler",
  pipes: [validatePipe, computeResultPipe, logEventPipe],
  connections: [
    { from: "validate-input", to: "compute-result", kind: "event" },
    { from: "compute-result", to: "log-event", kind: "event" },
  ],
};

/** incident-escalation handler 흐름 — 대칭 구조 */
const incidentValidatePipe: PipeSpec = {
  pipeId: "incident-validate",
  version: "v1",
  trigger: { eventKey: "incident_submit" },
  flow: {
    kind: "sequence",
    steps: [
      step("소비", "incident_escalation_input"),
      step("관리"),
    ],
  },
  produces: ["incident_validation_result"],
};

const incidentScorePipe: PipeSpec = {
  pipeId: "incident-score",
  version: "v1",
  trigger: { eventKey: "incident_validation_result" },
  flow: {
    kind: "sequence",
    steps: [
      step("소비"),
      step("생산", "incident_escalation_score"),
    ],
  },
  produces: ["incident_complete"],
};

const incidentLogPipe: PipeSpec = {
  pipeId: "incident-log",
  version: "v1",
  trigger: { eventKey: "incident_complete" },
  flow: {
    kind: "tap",
    observe: step("소비", "incident_escalation_logged"),
    step: step("소비"),
  },
};

const incidentHandlerGraph: PipeGraph = {
  graphId: "incident-escalation-handler",
  pipes: [incidentValidatePipe, incidentScorePipe, incidentLogPipe],
  connections: [
    { from: "incident-validate", to: "incident-score", kind: "event" },
    { from: "incident-score", to: "incident-log", kind: "event" },
  ],
};

// ── 통합 테스트 ──────────────────────────────────────

describe("context-action 시뮬레이션 — 구조 + 흐름 검증", () => {

  describe("1단계: scope-nesting 계약 하향 검증", () => {
    it("정상 provider stack — 계약 하향 성립", () => {
      const result = validateScopeNesting(playbookNesting);
      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === "error")).toHaveLength(0);
    });

    it("계약 하향 경로가 4개 계약 전부 추적", () => {
      const result = validateScopeNesting(playbookNesting);
      expect(result.descentPaths).toHaveLength(4);

      const logging = result.descentPaths.find(d => d.contractId === "logging-session")!;
      expect(logging.providedBy).toBe("qa-bridge");
      expect(logging.providerDepth).toBe(0);
      // feature-context, handlers 모두 소비
      expect(logging.consumedBy).toContain("feature-context");
      expect(logging.consumedBy).toContain("handlers");
    });

    it("qa-bridge ↔ feature-context 교환 시 계약 깨짐", () => {
      const errors = checkSwapSafety(playbookNesting, 0, 1);
      expect(errors).not.toBeNull();
      // feature-context가 logging-session을 소비하는데 qa-bridge가 하위로 가면 제공 불가
      expect(errors!.some(e => e.contractId === "logging-session")).toBe(true);
    });

    it("handlers ↔ view 교환 시 계약 깨짐", () => {
      const errors = checkSwapSafety(playbookNesting, 2, 3);
      expect(errors).not.toBeNull();
      expect(errors!.some(e => e.contractId === "submission-handlers")).toBe(true);
    });
  });

  describe("2단계: handlers PipeGraph 시뮬레이션", () => {

    describe("canonical-review handler", () => {
      it("정상 submit 흐름 — validate → compute → log 순서", () => {
        const result = simulate({
          graph: handlerGraph,
          initialEvent: { eventKey: "form_submit" },
        });

        expect(result.status).toBe("complete");
        expect(result.pipeTrace).toEqual([
          "validate-input", "compute-result", "log-event",
        ]);
      });

      it("happy path 매칭 — 패싯 순서 검증", () => {
        const result = simulate({
          graph: handlerGraph,
          initialEvent: { eventKey: "form_submit" },
        });

        const match = matchHappyPath(result, {
          expectedPipeTrace: ["validate-input", "compute-result", "log-event"],
          expectedFacets: ["소비", "관리", "소비", "생산", "소비", "소비"],
        });

        expect(match.match).toBe(true);
      });

      it("이벤트 체인 — 3개 이벤트 생산", () => {
        const result = simulate({
          graph: handlerGraph,
          initialEvent: { eventKey: "form_submit" },
        });

        const eventKeys = result.producedEvents.map(e => e.eventKey);
        expect(eventKeys).toContain("validation_result");
        expect(eventKeys).toContain("review_complete");
      });
    });

    describe("incident-escalation handler (구조 대칭)", () => {
      it("정상 submit 흐름 — validate → score → log 순서", () => {
        const result = simulate({
          graph: incidentHandlerGraph,
          initialEvent: { eventKey: "incident_submit" },
        });

        expect(result.status).toBe("complete");
        expect(result.pipeTrace).toEqual([
          "incident-validate", "incident-score", "incident-log",
        ]);
      });

      it("happy path 매칭 — canonical-review와 동일 패싯 구조", () => {
        const result = simulate({
          graph: incidentHandlerGraph,
          initialEvent: { eventKey: "incident_submit" },
        });

        const match = matchHappyPath(result, {
          expectedPipeTrace: ["incident-validate", "incident-score", "incident-log"],
          expectedFacets: ["소비", "관리", "소비", "생산", "소비", "소비"],
        });

        expect(match.match).toBe(true);
      });
    });

    describe("구조 대칭 검증 — 두 feature의 패싯 구조가 동일", () => {
      it("두 handler graph의 패싯 트레이스가 동일", () => {
        const reviewResult = simulate({
          graph: handlerGraph,
          initialEvent: { eventKey: "form_submit" },
        });
        const incidentResult = simulate({
          graph: incidentHandlerGraph,
          initialEvent: { eventKey: "incident_submit" },
        });

        expect(reviewResult.facetTrace).toEqual(incidentResult.facetTrace);
      });

      it("두 handler graph의 파이프 수와 연결 수가 동일", () => {
        expect(handlerGraph.pipes.length).toBe(incidentHandlerGraph.pipes.length);
        expect(handlerGraph.connections.length).toBe(incidentHandlerGraph.connections.length);
      });
    });
  });

  describe("3단계: 통합 — nesting 유효 + 시뮬 통과 = feature 정합", () => {
    it("scope nesting 유효 + canonical-review 시뮬 통과", () => {
      const nestingResult = validateScopeNesting(playbookNesting);
      expect(nestingResult.valid).toBe(true);

      const simResult = simulate({
        graph: handlerGraph,
        initialEvent: { eventKey: "form_submit" },
      });
      expect(simResult.status).toBe("complete");

      const happyPath = matchHappyPath(simResult, {
        expectedPipeTrace: ["validate-input", "compute-result", "log-event"],
      });
      expect(happyPath.match).toBe(true);
    });

    it("scope nesting 유효 + incident-escalation 시뮬 통과", () => {
      const nestingResult = validateScopeNesting(playbookNesting);
      expect(nestingResult.valid).toBe(true);

      const simResult = simulate({
        graph: incidentHandlerGraph,
        initialEvent: { eventKey: "incident_submit" },
      });
      expect(simResult.status).toBe("complete");

      const happyPath = matchHappyPath(simResult, {
        expectedPipeTrace: ["incident-validate", "incident-score", "incident-log"],
      });
      expect(happyPath.match).toBe(true);
    });
  });
});
