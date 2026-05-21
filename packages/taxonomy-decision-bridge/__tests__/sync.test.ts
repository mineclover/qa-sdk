import { describe, it, expect } from "vitest";
import type { EntryIR } from "taxonomy-engine";
import { computeSyncAction } from "../src/sync.js";
import type { DecisionFile } from "../src/decision-file.js";

const SUBJECT = "tax:lesson-builder-content:layer.cue";

function entry(partial: Partial<EntryIR>): EntryIR {
  return {
    id: "cue",
    address: 3,
    ...partial,
  };
}

function decision(partial: Partial<DecisionFile["meta"]> = {}, evidenceCount = 0): DecisionFile {
  return {
    meta: {
      id: "lesson-builder.layer.cue",
      subject: SUBJECT,
      lifecycle: "draft",
      created: "2026-05-21T00:00:00Z",
      updated: "2026-05-21T00:00:00Z",
      ...partial,
    },
    markers: {
      options: [],
      evidence: Array.from({ length: evidenceCount }, (_, i) => ({
        kind: "data",
        weight: 1,
        text: `e${i}`,
      })),
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

  it("yaml tbd + decision approved → pull-yaml-lifecycle (yaml에 반영)", () => {
    const action = computeSyncAction(
      entry({ lifecycle: "tbd", decisionLink: "./d.md" }),
      SUBJECT,
      decision({ lifecycle: "approved" }, 2),
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
      decision({ lifecycle: "draft" }),
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
      decision({ lifecycle: "review" }, 1),
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
      decision({ lifecycle: "review" }),
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
      decision({ lifecycle: "review" }, 2),
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
      decision({ lifecycle: "review" }, 3),
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
      decision({ lifecycle: "approved" }),
    );
    expect(action).toEqual({ kind: "noop", reason: "in-sync" });
  });
});
