/**
 * Frontmatter 파서 + 스캐너
 *
 * .md 파일의 YAML frontmatter에서 definition 메타데이터를 추출하고,
 * 디렉토리를 스캔하여 MemoryDefinitionRegistry를 자동 구성한다.
 *
 * frontmatter 스키마:
 * ```yaml
 * ---
 * def:
 *   id: gate-service-spec
 *   scope: interface
 *   aspect: api_contract
 *   depth: specification
 *   lifecycle: approved
 *   tags: [security, performance]
 *   links:
 *     - target: gate-engine-spec
 *       type: depends_on
 * ---
 * ```
 *
 * SSOT 원칙: frontmatter가 유일한 입력, registry는 파생 인덱스.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  ALL_DOMAIN_IDS,
  ALL_GATE_KIND_IDS,
  getSubDomain,
  type QualityGateSpec,
} from "work-domain";
import type {
  DefLevel,
  DefScope,
  DefAspect,
  DefDocType,
  KnowledgeKind,
  DefDepth,
  DefLifecycle,
  DefLayer,
  LinkType,
  EffectiveConcerns,
} from "./types.js";
import { isValidScopeAspect } from "./taxonomy.js";
import { MemoryDefinitionRegistry } from "./registry.js";
import { computeEffectiveConcerns } from "./concern.js";

// ─── Frontmatter 타입 ────────────────────────────────────

/** frontmatter에서 파싱된 link 선언 */
export interface FrontmatterLink {
  readonly target: string;
  readonly type: LinkType;
}

/** frontmatter에서 파싱된 def 블록 */
export interface FrontmatterDef {
  readonly id: string;
  /** 좌표 주소 — def_document:v1:<N> (파일 소유, DB에서도 계산) */
  readonly address?: string;
  /** 사람 기준 버전 ID (예: v1, 2026.03) */
  readonly version?: string;
  /** 개정 번호 (기본: 1) */
  readonly revision?: number;
  /** 문서 유형 — spec(기본) | knowledge */
  readonly type?: DefDocType;
  /** knowledge 문서의 세부 종류 */
  readonly knowledge_kind?: KnowledgeKind;
  /** 분해 레벨 — 전체-부분 구조에서의 위치 (기본: leaf) */
  readonly level: DefLevel;
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
  readonly lifecycle: DefLifecycle;
  /** 존재론적 계층 — business / interaction / binding (선택, 기본: business) */
  readonly layer?: DefLayer;
  readonly tags?: readonly string[];
  readonly links?: readonly FrontmatterLink[];
  /** 서비스 레지스트리 연결 (serviceId) */
  readonly svc?: string;
}

/** frontmatter에서 파싱된 gate 블록 */
export type FrontmatterGate = QualityGateSpec;

/** 파싱 결과 */
export interface ParsedDocument {
  /** frontmatter def 블록 */
  readonly def: FrontmatterDef;
  /** 선택적 품질 게이트 블록 */
  readonly gate?: FrontmatterGate;
  /** 파일 경로 (baseDir 기준 상대) */
  readonly filePath: string;
  /** frontmatter 이후 본문 */
  readonly body: string;
}

/** 스캔 결과 */
export interface ScanResult {
  /** 등록된 문서 수 */
  readonly registered: number;
  /** 연결된 관계 수 */
  readonly linked: number;
  /** 파싱 에러 (파일 경로 → 에러 메시지) */
  readonly errors: readonly { file: string; error: string }[];
  /** 관계 에러 (대상 미등록 등) */
  readonly linkErrors: readonly { source: string; target: string; error: string }[];
  /** 구성된 레지스트리 */
  readonly registry: MemoryDefinitionRegistry;
}

// ─── Frontmatter 파서 (zero-dep) ─────────────────────────

/**
 * 마크다운 파일에서 YAML frontmatter를 추출한다.
 * `---`로 시작하고 `---`로 끝나는 블록.
 */
export function extractFrontmatter(content: string): { yaml: string; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) return { yaml: match[1], body: match[2] };
  // 빈 frontmatter: ---\n---
  const empty = content.match(/^---\r?\n---\r?\n?([\s\S]*)$/);
  if (empty) return { yaml: "", body: empty[1] };
  return null;
}

/**
 * 간단한 YAML 파서 — def 블록에 필요한 구조만 지원.
 *
 * 지원:
 *  - 스칼라 (string, number, boolean)
 *  - 인라인 배열 [a, b, c]
 *  - 블록 시퀀스 (- item)
 *  - 1단계 중첩 (def: ... 아래 키)
 *  - 2단계 중첩 (links: - target: ... type: ...)
 *
 * 구현은 yaml-lite.ts에 분리. re-export로 하위 호환 유지.
 */
import { parseYaml, parseScalar } from "./yaml-lite.js";
export { parseYaml, parseScalar };


// ─── Frontmatter → DefinitionEntryInput 변환 ────────────

const VALID_LEVELS = new Set(["group", "module", "leaf"]);
const VALID_SCOPES = new Set(["ui", "feature", "flow", "state", "constraint", "data", "interface"]);
const VALID_DEPTHS = new Set(["overview", "specification", "implementation", "validation"]);
const VALID_LIFECYCLES = new Set(["draft", "review", "approved", "deprecated", "archived"]);
const VALID_LAYERS = new Set(["domain", "operation", "mediation", "experience"]);
const VALID_LINK_TYPES = new Set(["depends_on", "implements", "refines", "constrains", "traces_to", "contains", "evolves_from", "supersedes"]);
const VALID_WORK_DOMAINS = new Set<string>(ALL_DOMAIN_IDS);
const VALID_GATE_KINDS = new Set<string>(ALL_GATE_KIND_IDS);

/**
 * 파싱된 YAML에서 FrontmatterDef를 추출하고 검증한다.
 */
export function extractDef(parsed: Record<string, unknown>, filePath: string): FrontmatterDef {
  const def = parsed.def;
  if (!def || typeof def !== "object" || Array.isArray(def)) {
    throw new Error(`${filePath}: 'def' 블록이 없거나 올바르지 않습니다`);
  }

  const d = def as Record<string, unknown>;

  // 필수 필드 검증
  const id = d.id;
  if (typeof id !== "string" || id.length === 0) throw new Error(`${filePath}: def.id 필수`);

  const scope = d.scope;
  if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) {
    throw new Error(`${filePath}: def.scope 유효하지 않음: "${scope}"`);
  }

  const aspect = d.aspect;
  if (typeof aspect !== "string") {
    throw new Error(`${filePath}: def.aspect 필수`);
  }

  if (!isValidScopeAspect(scope as DefScope, aspect as DefAspect)) {
    throw new Error(`${filePath}: scope "${scope}" + aspect "${aspect}" 조합 유효하지 않음`);
  }

  const depth = d.depth;
  if (typeof depth !== "string" || !VALID_DEPTHS.has(depth)) {
    throw new Error(`${filePath}: def.depth 유효하지 않음: "${depth}"`);
  }

  const lifecycle = d.lifecycle ?? "draft";
  if (typeof lifecycle !== "string" || !VALID_LIFECYCLES.has(lifecycle)) {
    throw new Error(`${filePath}: def.lifecycle 유효하지 않음: "${lifecycle}"`);
  }

  // 선택 필드
  const tags = Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === "string") : undefined;

  const links: FrontmatterLink[] = [];
  if (Array.isArray(d.links)) {
    for (const item of d.links) {
      if (typeof item === "object" && item !== null) {
        const l = item as Record<string, string>;
        if (typeof l.target === "string" && typeof l.type === "string" && VALID_LINK_TYPES.has(l.type)) {
          links.push({ target: l.target, type: l.type as LinkType });
        }
      }
    }
  }

  // svc (서비스 레지스트리 연결)
  const svc = typeof d.svc === "string" ? d.svc : undefined;

  // level (분해 레벨 — 선택, 기본 "leaf")
  const rawLevel = d.level;
  const level = typeof rawLevel === "string" && VALID_LEVELS.has(rawLevel) ? rawLevel : "leaf";

  // layer (존재론적 계층 — 선택, 기본 없음)
  const layer = typeof d.layer === "string" && VALID_LAYERS.has(d.layer) ? d.layer as DefLayer : undefined;

  // address (좌표 주소 — 파일 소유, 선택)
  const address = typeof d.address === "string" ? d.address : undefined;
  const version = typeof d.version === "string" ? d.version : undefined;
  const revision = typeof d.revision === "number"
    ? d.revision
    : typeof d.revision === "string" && /^\d+$/.test(d.revision)
      ? Number(d.revision)
      : undefined;

  // type (문서 유형 — spec | knowledge, 기본: spec)
  const VALID_DOC_TYPES = new Set(["spec", "knowledge"]);
  const docType = typeof d.type === "string" && VALID_DOC_TYPES.has(d.type) ? d.type as DefDocType : undefined;

  // knowledge_kind (knowledge 문서 세부 종류)
  const VALID_KNOWLEDGE_KINDS = new Set(["philosophy", "adr", "guide", "narrative", "convention", "pattern"]);
  const knowledgeKind = typeof d.knowledge_kind === "string" && VALID_KNOWLEDGE_KINDS.has(d.knowledge_kind) ? d.knowledge_kind as KnowledgeKind : undefined;

  return {
    id: id as string,
    ...(address ? { address } : {}),
    ...(version ? { version } : {}),
    ...(revision !== undefined ? { revision } : {}),
    ...(docType ? { type: docType } : {}),
    ...(knowledgeKind ? { knowledge_kind: knowledgeKind } : {}),
    level: level as DefLevel,
    scope: scope as DefScope,
    aspect: aspect as DefAspect,
    depth: depth as DefDepth,
    lifecycle: lifecycle as DefLifecycle,
    ...(layer ? { layer } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(svc ? { svc } : {}),
  };
}

/**
 * 파싱된 YAML에서 gate 블록을 추출하고 검증한다.
 *
 * gate 블록은 validation 문서가 실행 가능한 단일 품질 게이트를
 * 1:1로 정의할 때 사용한다.
 */
export function extractGate(
  parsed: Record<string, unknown>,
  filePath: string,
): FrontmatterGate | undefined {
  const gate = parsed.gate;
  if (gate === undefined) return undefined;
  if (typeof gate !== "object" || gate === null || Array.isArray(gate)) {
    throw new Error(`${filePath}: 'gate' 블록이 올바르지 않습니다`);
  }

  const g = gate as Record<string, unknown>;

  const kind = g.kind;
  if (typeof kind !== "string" || !VALID_GATE_KINDS.has(kind)) {
    throw new Error(`${filePath}: gate.kind 유효하지 않음: "${kind}"`);
  }

  const workDomain = g.workDomain;
  if (typeof workDomain !== "string" || !VALID_WORK_DOMAINS.has(workDomain)) {
    throw new Error(`${filePath}: gate.workDomain 유효하지 않음: "${workDomain}"`);
  }

  const command = g.command;
  if (typeof command !== "string" || command.trim().length === 0) {
    throw new Error(`${filePath}: gate.command 필수`);
  }

  const pickString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;
  const pickStringArray = (value: unknown): readonly string[] | undefined =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
  const subDomainId = pickString(g.subDomainId);
  if (subDomainId && !getSubDomain(
    workDomain as FrontmatterGate["workDomain"],
    subDomainId,
  )) {
    throw new Error(`${filePath}: gate.subDomainId 유효하지 않음: "${subDomainId}"`);
  }

  return {
    kind: kind as FrontmatterGate["kind"],
    workDomain: workDomain as FrontmatterGate["workDomain"],
    command: command,
    ...(subDomainId ? { subDomainId } : {}),
    ...(pickString(g.storyId) ? { storyId: pickString(g.storyId) } : {}),
    ...(pickString(g.package) ? { package: pickString(g.package) } : {}),
    ...(pickString(g.successPattern) ? { successPattern: pickString(g.successPattern) } : {}),
    ...(pickStringArray(g.references)?.length ? { references: pickStringArray(g.references) } : {}),
    ...(pickStringArray(g.suggestOnPass)?.length ? { suggestOnPass: pickStringArray(g.suggestOnPass) } : {}),
    ...(pickStringArray(g.suggestOnFail)?.length ? { suggestOnFail: pickStringArray(g.suggestOnFail) } : {}),
  };
}

/**
 * 마크다운 파일 내용을 파싱하여 ParsedDocument를 반환한다.
 */
export function parseDocument(content: string, filePath: string): ParsedDocument {
  const fm = extractFrontmatter(content);
  if (!fm) throw new Error(`${filePath}: frontmatter가 없습니다`);

  const parsed = parseYaml(fm.yaml);
  const def = extractDef(parsed, filePath);
  const gate = extractGate(parsed, filePath);

  return {
    def,
    ...(gate ? { gate } : {}),
    filePath,
    body: fm.body,
  };
}

// ─── 파일 시스템 스캐너 ──────────────────────────────────

/**
 * 디렉토리를 재귀 스캔하여 .md 파일 목록을 반환한다.
 */
async function scanMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(d: string) {
    const entries = await readdir(d);
    for (const entry of entries) {
      const fullPath = join(d, entry);
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        await walk(fullPath);
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * 디렉토리를 스캔하여 frontmatter가 있는 .md 파일을 모두 등록한다.
 *
 * 1단계: 모든 .md 파일 파싱 → def 블록 추출
 * 2단계: registry에 등록 (좌표 자동 계산)
 * 3단계: link 연결 (모든 문서 등록 후)
 *
 * @param baseDir 스캔 시작 디렉토리 (상대 경로의 기준)
 * @param dirs 스캔할 디렉토리 목록 (절대 경로)
 */
export async function scanAndBuild(
  baseDir: string,
  dirs: readonly string[],
): Promise<ScanResult> {
  const registry = new MemoryDefinitionRegistry();
  const errors: { file: string; error: string }[] = [];
  const linkErrors: { source: string; target: string; error: string }[] = [];
  const pendingLinks: { sourceId: string; link: FrontmatterLink }[] = [];

  // 1단계: 파일 스캔 + 파싱
  const allFiles: string[] = [];
  for (const dir of dirs) {
    const files = await scanMarkdownFiles(dir);
    allFiles.push(...files);
  }

  // 2단계: 등록
  const now = new Date().toISOString();
  for (const filePath of allFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const fm = extractFrontmatter(content);
      if (!fm) continue; // frontmatter 없는 파일은 건너뜀

      const parsed = parseYaml(fm.yaml);
      if (!parsed.def) continue; // def 블록 없으면 건너뜀

      const doc = parseDocument(content, filePath);
      const def = doc.def;
      const relPath = relative(baseDir, filePath);

      registry.register({
        id: def.id,
        title: fm.body.match(/^#\s+(.+)/m)?.[1] ?? def.id,
        type: def.type,
        knowledgeKind: def.knowledge_kind,
        level: def.level,
        scope: def.scope,
        aspect: def.aspect,
        depth: def.depth,
        lifecycle: def.lifecycle,
        layer: def.layer,
        tags: def.tags ? [...def.tags] : undefined,
        ref: relPath,
        serviceId: def.svc,
        gate: doc.gate,
        createdAt: now,
        updatedAt: now,
      });

      // 링크는 모든 문서 등록 후 연결
      if (def.links) {
        for (const link of def.links) {
          pendingLinks.push({ sourceId: def.id, link });
        }
      }
    } catch (e) {
      errors.push({ file: filePath, error: (e as Error).message });
    }
  }

  // 3단계: 관계 연결
  let linked = 0;
  for (const { sourceId, link } of pendingLinks) {
    try {
      registry.link(sourceId, link.target, link.type);
      linked++;
    } catch (e) {
      linkErrors.push({ source: sourceId, target: link.target, error: (e as Error).message });
    }
  }

  return { registered: registry.all().length, linked, errors, linkErrors, registry };
}

/**
 * 스캔 결과에서 모든 문서의 effective concerns를 계산한다.
 */
export function computeAllConcerns(
  registry: MemoryDefinitionRegistry,
): Map<string, EffectiveConcerns> {
  const result = new Map<string, EffectiveConcerns>();
  for (const entry of registry.all()) {
    result.set(entry.id, computeEffectiveConcerns(
      entry.id,
      id => registry.get(id),
      (id, dir) => registry.getLinks(id, dir),
    ));
  }
  return result;
}
