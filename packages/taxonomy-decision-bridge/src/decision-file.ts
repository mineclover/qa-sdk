import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Lifecycle } from "taxonomy-engine";

export type DecisionMeta = {
  id: string;
  subject: string;
  lifecycle: Lifecycle;
  created: string;
  updated: string;
};

export type DecisionOption = {
  id: string;
  body: string;
};

export type DecisionEvidence = {
  kind: string;
  weight: number;
  text: string;
};

export type DecisionMarkers = {
  purpose?: string;
  context?: string;
  options: DecisionOption[];
  evidence: DecisionEvidence[];
  outcome?: string;
};

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
    markers: { options: [], evidence: [] },
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
  };
  const blocks = splitIntoBlocks(body);
  for (const block of blocks) {
    for (const marker of findMarkers(block)) {
      const text = stripMarker(block, marker.raw).trim();
      applyMarker(result, marker, text);
    }
  }
  return result;
}

type MarkerToken =
  | { kind: "purpose"; raw: string }
  | { kind: "context"; raw: string }
  | { kind: "option"; id: string; raw: string }
  | { kind: "evidence"; evKind: string; weight: number; raw: string }
  | { kind: "outcome"; raw: string };

const MARKER_RE = /\^(purpose|context|outcome|option:[a-zA-Z][\w-]*|evidence:[a-zA-Z][\w-]*(?:\s+weight=[\d.]+)?)/g;

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
    }
  }
  return tokens;
}

function stripMarker(block: string, marker: string): string {
  return block.replace(marker, "");
}

function applyMarker(
  result: DecisionMarkers,
  marker: MarkerToken,
  text: string,
): void {
  switch (marker.kind) {
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
      result.evidence.push({
        kind: marker.evKind,
        weight: marker.weight,
        text,
      });
      return;
  }
}

/**
 * markdown 본문을 빈 줄(또는 heading)으로 분리한 블록 배열.
 */
function splitIntoBlocks(body: string): string[] {
  return body.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b.length > 0);
}
