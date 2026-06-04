import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Lifecycle } from "taxonomy-engine";
import type {
  CognitivePhase,
  Evidence,
  EvidenceKind,
  GateWeight,
} from "decision-flow";

/**
 * decision-flow의 GateDependency는 named export가 아니므로 동형 type을 자체 정의.
 * GateSchema.affects의 element와 구조 동일 — decision-flow 변경 없이 매핑 호환.
 */
export type GateDependency = {
  readonly gateId: string;
  readonly kind: "constrains" | "enables" | "invalidates";
};

export type DecisionMeta = {
  id: string;
  subject: string;
  lifecycle: Lifecycle;
  created: string;
  updated: string;
};

/**
 * 옵션 평가 annotation. ^cost:<id> / ^benefit:<id> / ^risk:<id> 마커가 동일 id의
 * option에 attach. 같은 option에 여러 annotation이 가능 (kind별 1건씩).
 *
 * 마커-only 확장 — toFlowSchema는 annotation을 schema에 반영하지 않음 (BranchSchema
 * 변경 없음). 라운드트립은 toMarkdown이 본문에 다시 출력하여 보존.
 */
export type OptionAnnotation = {
  kind: "cost" | "benefit" | "risk";
  body: string;
};

export type DecisionOption = {
  id: string;
  body: string;
  annotations?: readonly OptionAnnotation[];
};

const VALID_ANNOTATION_KINDS: ReadonlySet<OptionAnnotation["kind"]> = new Set([
  "cost",
  "benefit",
  "risk",
]);

function isAnnotationKind(s: string): s is OptionAnnotation["kind"] {
  return VALID_ANNOTATION_KINDS.has(s as OptionAnnotation["kind"]);
}

/**
 * 마커에서 추출된 증거. decision-flow의 Evidence와 동일 모델.
 * source는 변환 시점에 호출자가 채움 (markdown 파일 path 또는 빈 문자열).
 */
export type DecisionEvidence = Evidence;

/**
 * multi-gate decision의 한 gate에 속한 마커들 (v0.13).
 * ^gate:<id> 마커 이후 등장하는 ^option/^evidence/^phase/^weight/^depends_on이 이 gate 소속.
 */
export type GateMarkers = {
  id: string;
  name?: string;
  phase?: CognitivePhase;
  weight?: GateWeight;
  options: DecisionOption[];
  evidence: DecisionEvidence[];
  dependsOn: GateDependency[];
};

export type DecisionMarkers = {
  purpose?: string;
  context?: string;
  outcome?: string;
  /** single-gate (backward compat) — gates 비어있을 때 사용. */
  options: DecisionOption[];
  evidence: DecisionEvidence[];
  dependsOn: GateDependency[];
  phase?: CognitivePhase;
  weight?: GateWeight;
  /** multi-gate (v0.13) — 채워졌으면 toFlowSchema가 N gates 반환. */
  gates: GateMarkers[];
};

/**
 * decision-flow EvidenceKind 5종. 마커의 kind가 이 안에 없으면 evidence에서 제외 (skip).
 */
const VALID_EVIDENCE_KINDS: ReadonlySet<EvidenceKind> = new Set([
  "data",
  "rule",
  "precedent",
  "intuition",
  "external",
]);

function isEvidenceKind(s: string): s is EvidenceKind {
  return VALID_EVIDENCE_KINDS.has(s as EvidenceKind);
}

const VALID_PHASES: ReadonlySet<CognitivePhase> = new Set([
  "perceive",
  "interpret",
  "evaluate",
  "decide",
  "plan",
  "execute",
  "reflect",
]);

function isPhase(s: string): s is CognitivePhase {
  return VALID_PHASES.has(s as CognitivePhase);
}

const VALID_WEIGHTS: ReadonlySet<GateWeight> = new Set([
  "core",
  "structural",
  "tactical",
]);

function isWeight(s: string): s is GateWeight {
  return VALID_WEIGHTS.has(s as GateWeight);
}

const VALID_DEP_KINDS: ReadonlySet<GateDependency["kind"]> = new Set([
  "constrains",
  "enables",
  "invalidates",
]);

function isDepKind(s: string): s is GateDependency["kind"] {
  return VALID_DEP_KINDS.has(s as GateDependency["kind"]);
}

export type DecisionFile = {
  meta: DecisionMeta;
  markers: DecisionMarkers;
  body: string;
};

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseDecisionFile(text: string): DecisionFile {
  const m = text.match(FRONTMATTER_RE);
  if (!m) throw new Error("frontmatter 누락: --- ... --- 블록 필요");
  const fmText = m[1];
  const body = m[2] ?? "";

  const raw = parseYaml(fmText) as Record<string, unknown>;
  const meta = validateMeta(raw);
  const markers = extractMarkers(body);
  return { meta, markers, body };
}

export function serializeDecisionFile(file: DecisionFile): string {
  const fm = stringifyYaml(file.meta);
  return `---\n${fm}---\n${file.body}`;
}

/**
 * push-create 시 skeleton decision 파일 텍스트를 만든다.
 * lifecycle은 보통 "draft"로 시작.
 */
export function createDecisionSkeletonText(opts: {
  id: string;
  subject: string;
  question: string;
  lifecycle: Lifecycle;
}): string {
  const now = new Date().toISOString();
  const file: DecisionFile = {
    meta: {
      id: opts.id,
      subject: opts.subject,
      lifecycle: opts.lifecycle,
      created: now,
      updated: now,
    },
    markers: { options: [], evidence: [], dependsOn: [], gates: [] },
    body: `\n# Decision: ${opts.subject}\n\n${opts.question} ^purpose\n\n## 검토할 옵션\n\n(미정)\n\n## 증거\n\n(미정)\n\n## 결정\n\n(미정) ^outcome\n`,
  };
  return serializeDecisionFile(file);
}

function validateMeta(raw: Record<string, unknown>): DecisionMeta {
  const id = expectString(raw.id, "id");
  const subject = expectString(raw.subject, "subject");
  const lifecycle = expectLifecycle(raw.lifecycle);
  const created = expectString(raw.created, "created");
  const updated = expectString(raw.updated, "updated");
  return { id, subject, lifecycle, created, updated };
}

function expectString(v: unknown, name: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`frontmatter.${name} 필수 (string)`);
  }
  return v;
}

const VALID_LIFECYCLES: ReadonlySet<Lifecycle> = new Set([
  "draft",
  "review",
  "approved",
  "deprecated",
  "archived",
  "tbd",
]);

function expectLifecycle(v: unknown): Lifecycle {
  if (typeof v !== "string" || !VALID_LIFECYCLES.has(v as Lifecycle)) {
    throw new Error(`frontmatter.lifecycle 잘못된 값: ${String(v)}`);
  }
  return v as Lifecycle;
}

/**
 * 본문에서 마커 추출.
 *
 * 마커 형식:
 * - `... ^purpose` — 그 단어가 등장한 문단 텍스트가 purpose
 * - `... ^context` — 같은 패턴
 * - `... ^option:<id>` — 같은 패턴 + id 보존
 * - `... ^evidence:<kind> weight=N` — 같은 패턴 + kind/weight 추출
 * - `... ^outcome` — 같은 패턴
 *
 * "문단"은 빈 줄로 구분된 텍스트 블록. 같은 블록에 마커가 여러 개면 각각 추출.
 */
export function extractMarkers(body: string): DecisionMarkers {
  const result: DecisionMarkers = {
    options: [],
    evidence: [],
    dependsOn: [],
    gates: [],
  };
  // multi-gate 인식 — ^gate:<id> 마커 등장 시 그 이후 ^option/^evidence/^phase/^weight/^depends_on은
  // 해당 gate에 push. 첫 ^gate 전 콘텐츠는 schema 전체(기존 single-gate 호환).
  let currentGate: GateMarkers | undefined;
  type PendingAnnotation = {
    annKind: string;
    optionId: string;
    body: string;
    inGateId?: string;
  };
  const pendingAnnotations: PendingAnnotation[] = [];

  const blocks = splitIntoBlocks(body);
  for (const block of blocks) {
    const cleanText = stripAllMarkers(block).trim();
    for (const marker of findMarkers(block)) {
      if (marker.kind === "gate") {
        currentGate = {
          id: marker.gateId,
          options: [],
          evidence: [],
          dependsOn: [],
        };
        result.gates.push(currentGate);
        continue;
      }
      if (marker.kind === "annotation") {
        pendingAnnotations.push({
          annKind: marker.annKind,
          optionId: marker.optionId,
          body: cleanText,
          inGateId: currentGate?.id,
        });
        continue;
      }
      // schema 전체 마커는 항상 result에
      if (marker.kind === "purpose" || marker.kind === "context" || marker.kind === "outcome") {
        applyMarker(result, marker, cleanText);
        continue;
      }
      // gate 안에서 등장한 마커는 그 gate에 push, 아니면 schema 전체(기존 single-gate)
      if (currentGate) {
        applyMarkerToGate(currentGate, marker, cleanText);
      } else {
        applyMarker(result, marker, cleanText);
      }
    }
  }
  // annotation 2차 패스: option id로 매칭해 attach.
  // 같은 gate 우선 → 다른 gate → single-gate options.
  for (const pa of pendingAnnotations) {
    if (!isAnnotationKind(pa.annKind)) continue;
    const target = findOptionById(result, pa.optionId, pa.inGateId);
    if (!target) continue;
    appendAnnotation(target, { kind: pa.annKind, body: pa.body });
  }
  return result;
}

function findOptionById(
  result: DecisionMarkers,
  optionId: string,
  preferredGateId: string | undefined,
): { ref: DecisionOption; replace: (next: DecisionOption) => void } | undefined {
  // 1. preferred gate 우선
  if (preferredGateId) {
    const gate = result.gates.find((g) => g.id === preferredGateId);
    if (gate) {
      const idx = gate.options.findIndex((o) => o.id === optionId);
      if (idx >= 0) {
        return {
          ref: gate.options[idx],
          replace: (next) => {
            gate.options[idx] = next;
          },
        };
      }
    }
  }
  // 2. 다른 gates
  for (const gate of result.gates) {
    if (gate.id === preferredGateId) continue;
    const idx = gate.options.findIndex((o) => o.id === optionId);
    if (idx >= 0) {
      return {
        ref: gate.options[idx],
        replace: (next) => {
          gate.options[idx] = next;
        },
      };
    }
  }
  // 3. single-gate options
  const idx = result.options.findIndex((o) => o.id === optionId);
  if (idx >= 0) {
    return {
      ref: result.options[idx],
      replace: (next) => {
        result.options[idx] = next;
      },
    };
  }
  return undefined;
}

function appendAnnotation(
  target: { ref: DecisionOption; replace: (next: DecisionOption) => void },
  annotation: OptionAnnotation,
): void {
  const existing = target.ref.annotations ?? [];
  target.replace({
    ...target.ref,
    annotations: [...existing, annotation],
  });
}

function applyMarkerToGate(
  gate: GateMarkers,
  marker: MarkerToken,
  text: string,
): void {
  switch (marker.kind) {
    case "annotation":
      // annotation은 2차 패스에서 처리 — 여기선 no-op.
      return;
    case "option":
      gate.options.push({ id: marker.id, body: text });
      return;
    case "evidence":
      if (!isEvidenceKind(marker.evKind)) return;
      gate.evidence.push({
        kind: marker.evKind,
        weight: marker.weight,
        content: text,
        source: "",
      });
      return;
    case "phase":
      if (isPhase(marker.value)) gate.phase = marker.value;
      return;
    case "weight":
      if (isWeight(marker.value)) gate.weight = marker.value;
      return;
    case "depends_on":
      if (!marker.gateId) return;
      {
        const kind: GateDependency["kind"] =
          marker.depKind && isDepKind(marker.depKind)
            ? marker.depKind
            : "constrains";
        gate.dependsOn.push({ gateId: marker.gateId, kind });
      }
      return;
    default:
      return;
  }
}

type MarkerToken =
  | { kind: "purpose"; raw: string }
  | { kind: "context"; raw: string }
  | { kind: "option"; id: string; raw: string }
  | { kind: "evidence"; evKind: string; weight: number; raw: string }
  | { kind: "outcome"; raw: string }
  | { kind: "phase"; value: string; raw: string }
  | { kind: "weight"; value: string; raw: string }
  | { kind: "depends_on"; gateId: string; depKind?: string; raw: string }
  | { kind: "gate"; gateId: string; raw: string }
  | { kind: "annotation"; annKind: string; optionId: string; raw: string };

const MARKER_RE =
  /\^(purpose|context|outcome|option:[a-zA-Z][\w-]*|evidence:[a-zA-Z][\w-]*(?:\s+weight=[\d.]+)?|phase:[a-z]+|weight:[a-z]+|depends_on:[a-zA-Z][\w-]*(?::[a-z]+)?|gate:[a-zA-Z][\w-]*|cost:[a-zA-Z][\w-]*|benefit:[a-zA-Z][\w-]*|risk:[a-zA-Z][\w-]*)/g;

function findMarkers(block: string): MarkerToken[] {
  const tokens: MarkerToken[] = [];
  for (const m of block.matchAll(MARKER_RE)) {
    const raw = m[0];
    const body = m[1];
    if (body === "purpose" || body === "context" || body === "outcome") {
      tokens.push({ kind: body, raw } as MarkerToken);
    } else if (body.startsWith("option:")) {
      const id = body.slice("option:".length);
      tokens.push({ kind: "option", id, raw });
    } else if (body.startsWith("evidence:")) {
      const rest = body.slice("evidence:".length);
      const [evKind, weightExpr] = rest.split(/\s+/);
      const weight = weightExpr?.startsWith("weight=")
        ? Number(weightExpr.slice("weight=".length))
        : 1;
      tokens.push({ kind: "evidence", evKind, weight, raw });
    } else if (body.startsWith("phase:")) {
      tokens.push({ kind: "phase", value: body.slice("phase:".length), raw });
    } else if (body.startsWith("weight:")) {
      tokens.push({ kind: "weight", value: body.slice("weight:".length), raw });
    } else if (body.startsWith("depends_on:")) {
      const rest = body.slice("depends_on:".length);
      const [gateId, depKind] = rest.split(":");
      tokens.push({ kind: "depends_on", gateId, depKind, raw });
    } else if (body.startsWith("gate:")) {
      tokens.push({ kind: "gate", gateId: body.slice("gate:".length), raw });
    } else if (
      body.startsWith("cost:") ||
      body.startsWith("benefit:") ||
      body.startsWith("risk:")
    ) {
      const colon = body.indexOf(":");
      const annKind = body.slice(0, colon);
      const optionId = body.slice(colon + 1);
      tokens.push({ kind: "annotation", annKind, optionId, raw });
    }
  }
  return tokens;
}

function stripAllMarkers(block: string): string {
  // 마커 제거 후 줄바꿈은 보존하되, 각 줄의 양 끝 공백과 연속된 가로 공백만 정리한다.
  return block
    .replace(MARKER_RE, "")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .trim();
}

function applyMarker(
  result: DecisionMarkers,
  marker: MarkerToken,
  text: string,
): void {
  switch (marker.kind) {
    case "annotation":
    case "gate":
      // 별도 처리. 여기선 no-op.
      return;
    case "purpose":
      result.purpose = text;
      return;
    case "context":
      result.context = text;
      return;
    case "outcome":
      result.outcome = text;
      return;
    case "option":
      result.options.push({ id: marker.id, body: text });
      return;
    case "evidence":
      if (!isEvidenceKind(marker.evKind)) return;
      result.evidence.push({
        kind: marker.evKind,
        weight: marker.weight,
        content: text,
        source: "",
      });
      return;
    case "phase":
      if (isPhase(marker.value)) result.phase = marker.value;
      return;
    case "weight":
      if (isWeight(marker.value)) result.weight = marker.value;
      return;
    case "depends_on":
      if (!marker.gateId) return;
      {
        const kind: GateDependency["kind"] =
          marker.depKind && isDepKind(marker.depKind)
            ? marker.depKind
            : "constrains";
        result.dependsOn.push({ gateId: marker.gateId, kind });
      }
      return;
  }
}

/**
 * markdown 본문을 빈 줄(또는 heading)으로 분리한 블록 배열.
 */
function splitIntoBlocks(body: string): string[] {
  return body.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b.length > 0);
}
