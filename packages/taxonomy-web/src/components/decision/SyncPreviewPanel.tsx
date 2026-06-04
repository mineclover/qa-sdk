import { useMemo, useState } from "react";
import { computeSyncAction, type DecisionFile, type SyncAction } from "taxonomy-decision-bridge";
import type { Lifecycle } from "taxonomy-engine";

type Scenario = "no-link" | "lifecycle-match" | "tbd-vs-draft" | "yaml-changed" | "decision-changed" | "missing-file";

const SCENARIOS: { key: Scenario; label: string; desc: string }[] = [
  { key: "no-link", label: "yaml에 decisionLink 없음", desc: "noop: no-decision-link" },
  { key: "lifecycle-match", label: "yaml/decision lifecycle 동일", desc: "noop: in-sync (또는 markers-only)" },
  { key: "tbd-vs-draft", label: "yaml=tbd · decision=draft", desc: "noop: in-sync-tbd-draft (의도적 미시작)" },
  { key: "yaml-changed", label: "yaml lifecycle 변경됨 (yaml→review)", desc: "pull-decision-lifecycle: decision으로 전파" },
  { key: "decision-changed", label: "decision lifecycle 변경됨 (decision→review)", desc: "pull-yaml-lifecycle: yaml으로 전파" },
  { key: "missing-file", label: "decision 파일이 없음", desc: "push-create: skeleton 생성" },
];

/**
 * 현재 markdown DecisionFile에 대해 6가지 시나리오별 computeSyncAction 결과 미리보기.
 * yamlEntry는 합성 — 실제 yaml과 무관한 학습/탐색 용도.
 */
export function SyncPreviewPanel({ file }: { file: DecisionFile }) {
  const [scenario, setScenario] = useState<Scenario>("lifecycle-match");

  const action: SyncAction = useMemo(() => {
    return runScenario(scenario, file);
  }, [scenario, file]);

  return (
    <section className="border rounded p-2 bg-white">
      <h3 className="text-xs font-semibold text-gray-600 mb-1">
        🔄 sync action 미리보기
      </h3>
      <select
        value={scenario}
        onChange={(e) => setScenario(e.target.value as Scenario)}
        className="text-xs border rounded px-1 py-0.5 w-full mb-2"
      >
        {SCENARIOS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <div className="text-xs space-y-1">
        <div>
          <span className="text-gray-500 text-[10px] uppercase tracking-wide">action</span>
          <div className="font-mono text-blue-700">{action.kind}</div>
        </div>
        <ActionDetails action={action} />
        <div className="text-[10px] text-gray-500 mt-1">
          target: <span className="font-mono">docs/decisions/{file.meta.id}.md</span>
        </div>
      </div>
    </section>
  );
}

function ActionDetails({ action }: { action: SyncAction }) {
  if (action.kind === "noop") {
    return <Row label="reason" value={action.reason} />;
  }
  if (action.kind === "push-create") {
    return (
      <>
        <Row label="subject" value={action.subject} />
        <Row label="question" value={action.question} />
        <Row label="initialLifecycle" value={action.initialLifecycle} />
      </>
    );
  }
  if (action.kind === "pull-yaml-lifecycle") {
    return (
      <>
        <Row label="newLifecycle" value={action.newLifecycle} />
        <Row label="evidence" value={`${action.evidence.length}건 전파`} />
      </>
    );
  }
  if (action.kind === "pull-decision-lifecycle") {
    return <Row label="newLifecycle" value={action.newLifecycle} />;
  }
  if (action.kind === "conflict") {
    return (
      <>
        <Row label="yaml" value={action.yaml.lifecycle} />
        <Row label="decision" value={`${action.decision.lifecycle} (ev ${action.decision.evidenceCount})`} />
      </>
    );
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-1">
      <span className="text-gray-500 font-mono text-[10px]">{label}</span>
      <span className="font-mono text-gray-800 text-[11px]">{value}</span>
    </div>
  );
}

// ─── scenario 실행 ─────────────────────────────────────────

function runScenario(scenario: Scenario, file: DecisionFile): SyncAction {
  const baseEntry = {
    id: file.meta.id,
    address: 0,
    lifecycle: "draft" as Lifecycle,
    decisionLink: `decision:${file.meta.id}`,
  };

  switch (scenario) {
    case "no-link":
      return computeSyncAction(
        { ...baseEntry, decisionLink: undefined },
        file.meta.subject,
        file,
      );
    case "lifecycle-match":
      return computeSyncAction(
        { ...baseEntry, lifecycle: file.meta.lifecycle },
        file.meta.subject,
        file,
      );
    case "tbd-vs-draft":
      return computeSyncAction(
        { ...baseEntry, lifecycle: "tbd" },
        file.meta.subject,
        { ...file, meta: { ...file.meta, lifecycle: "draft" } },
      );
    case "yaml-changed":
      return computeSyncAction(
        { ...baseEntry, lifecycle: "review" },
        file.meta.subject,
        { ...file, meta: { ...file.meta, lifecycle: "draft" } },
        { yamlChanged: true, decisionChanged: false },
      );
    case "decision-changed":
      return computeSyncAction(
        { ...baseEntry, lifecycle: "draft" },
        file.meta.subject,
        { ...file, meta: { ...file.meta, lifecycle: "review" } },
        { yamlChanged: false, decisionChanged: true },
      );
    case "missing-file":
      return computeSyncAction(
        { ...baseEntry, placeholderReason: file.markers.purpose ?? "(질문 미정)" },
        file.meta.subject,
        undefined,
      );
  }
}
