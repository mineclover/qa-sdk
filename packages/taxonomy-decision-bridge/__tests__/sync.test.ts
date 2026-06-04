import { describe, it, expect } from "vitest";
import type { EntryIR } from "taxonomy-engine";
import { computeSyncAction } from "../src/sync.js";
import type { DecisionFile, DecisionEvidence, DecisionOption } from "../src/decision-file.js";

const SUBJECT = "tax:lesson-builder-content:layer.cue";

function entry(partial: Partial<EntryIR>): EntryIR {
  return {
    id: "cue",
    address: 3,
    ...partial,
  };
}

type DecisionOverrides = {
  meta?: Partial<DecisionFile["meta"]>;
  evidenceCount?: number;
  evidence?: DecisionEvidence[];
  options?: DecisionOption[];
  purpose?: string;
  context?: string;
  outcome?: string;
};

function decision(opts: DecisionOverrides = {}): DecisionFile {
  const evidenceCount = opts.evidenceCount ?? 0;
  return {
    meta: {
      id: "lesson-builder.layer.cue",
      subject: SUBJECT,
      lifecycle: "draft",
      created: "2026-05-21T00:00:00Z",
      updated: "2026-05-21T00:00:00Z",
      ...opts.meta,
    },
    markers: {
      purpose: opts.purpose,
      context: opts.context,
      outcome: opts.outcome,
      options: opts.options ?? [],
      evidence:
        opts.evidence ??
        Array.from({ length: evidenceCount }, (_, i) => ({
          kind: "data" as const,
          weight: 1,
          content: `e${i}`,
          source: "",
        })),
      dependsOn: [],
      gates: [],
    },
    body: "",
  };
}

describe("computeSyncAction", () => {
  it("decisionLink 없음 → noop", () => {
    const action = computeSyncAction(entry({ lifecycle: "tbd" }), SUBJECT, undefined);
    expect(action).toEqual({ kind: "noop", reason: "no-decision-link" });
  });

  it("lifecycle 없음 → noop", () => {
    const action = computeSyncAction(entry({ decisionLink: "./d.md" }), SUBJECT, undefined);
    expect(action).toEqual({ kind: "noop", reason: "lifecycle-missing" });
  });

  it("yaml lifecycle: tbd + decision 파일 없음 → push-create", () => {
    const action = computeSyncAction(
      entry({
        lifecycle: "tbd",
        decisionLink: "./d.md",
        placeholderReason: "interaction 정의 미정",
      }),
      SUBJECT,
      undefined,
    );
    expect(action).toMatchObject({
      kind: "push-create",
      subject: SUBJECT,
      question: "interaction 정의 미정",
      initialLifecycle: "draft",
    });
  });

  it("placeholderReason 없으면 (질문 미정) default", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      undefined,
    );
    expect(action).toMatchObject({ kind: "push-create", question: "(질문 미정)" });
  });

  it("yaml tbd + decision draft → in-sync-tbd-draft (사용자 의도 보존, 부채 #1)", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "draft" } }),
    );
    expect(action).toEqual({ kind: "noop", reason: "in-sync-tbd-draft" });
  });

  it("yaml tbd + decision review → pull-yaml-lifecycle (decision 진행됨)", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "review" }, evidenceCount: 1 }),
    );
    expect(action).toMatchObject({
      kind: "pull-yaml-lifecycle",
      newLifecycle: "review",
    });
  });

  it("yaml tbd + decision approved → pull-yaml-lifecycle (yaml에 반영)", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "approved" }, evidenceCount: 2 }),
    );
    expect(action).toMatchObject({
      kind: "pull-yaml-lifecycle",
      newLifecycle: "approved",
    });
    if (action.kind === "pull-yaml-lifecycle") {
      expect(action.evidence).toHaveLength(2);
    }
  });

  it("yaml approved + decision draft (yaml 단독 변경) → pull-decision-lifecycle", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "draft" } }),
      { yamlChanged: true, decisionChanged: false },
    );
    expect(action).toMatchObject({
      kind: "pull-decision-lifecycle",
      newLifecycle: "approved",
    });
  });

  it("yaml approved + decision review + 양쪽 변경 → conflict (옵션 없으면)", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "review" }, evidenceCount: 1 }),
      { yamlChanged: true, decisionChanged: true },
    );
    expect(action.kind).toBe("conflict");
    if (action.kind === "conflict") {
      expect(action.yaml.lifecycle).toBe("approved");
      expect(action.decision.lifecycle).toBe("review");
      expect(action.decision.evidenceCount).toBe(1);
    }
  });

  it("충돌 + --accept-yaml → pull-decision-lifecycle", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "review" } }),
      { yamlChanged: true, decisionChanged: true },
      { conflict: "accept-yaml" },
    );
    expect(action).toMatchObject({
      kind: "pull-decision-lifecycle",
      newLifecycle: "approved",
    });
  });

  it("충돌 + --accept-decision → pull-yaml-lifecycle", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "review" }, evidenceCount: 2 }),
      { yamlChanged: true, decisionChanged: true },
      { conflict: "accept-decision" },
    );
    expect(action).toMatchObject({
      kind: "pull-yaml-lifecycle",
      newLifecycle: "review",
    });
  });

  it("충돌 + --merge → yaml lifecycle 우선 + evidence 보존", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "review" }, evidenceCount: 3 }),
      { yamlChanged: true, decisionChanged: true },
      { conflict: "merge" },
    );
    expect(action).toMatchObject({
      kind: "pull-yaml-lifecycle",
      newLifecycle: "approved",
    });
    if (action.kind === "pull-yaml-lifecycle") {
      expect(action.evidence).toHaveLength(3);
    }
  });

  it("양쪽 lifecycle 동일 → noop in-sync", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ meta: { lifecycle: "approved" } }),
    );
    expect(action).toEqual({ kind: "noop", reason: "in-sync" });
  });

  it("같은 lifecycle + markers만 변경 → markers-only (부채 #8)", () => {
    const prev = decision({
      meta: { lifecycle: "draft" },
      evidence: [{ kind: "data", weight: 1, content: "원본", source: "" }],
    });
    const current = decision({
      meta: { lifecycle: "draft" },
      evidence: [
        { kind: "data", weight: 1, content: "원본", source: "" },
        { kind: "precedent", weight: 0.8, content: "신규", source: "" },
      ],
    });
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      current,
      { previousDecision: prev },
    );
    expect(action).toEqual({ kind: "noop", reason: "markers-only" });
  });

  it("같은 lifecycle + markers 변경 없음 → in-sync-tbd-draft 유지", () => {
    const same = decision({ meta: { lifecycle: "draft" }, evidenceCount: 1 });
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      same,
      { previousDecision: same },
    );
    expect(action).toEqual({ kind: "noop", reason: "in-sync-tbd-draft" });
  });

  it("approved 동일 + outcome 변경 → markers-only", () => {
    const prev = decision({ meta: { lifecycle: "approved" }, outcome: "기존 결정" });
    const current = decision({ meta: { lifecycle: "approved" }, outcome: "수정된 결정" });
    const action = computeSyncAction(
      entry({ lifecycle: "approved", decisionLink: "./d.md" }),
      SUBJECT,
      current,
      { previousDecision: prev },
    );
    expect(action).toEqual({ kind: "noop", reason: "markers-only" });
  });
});
