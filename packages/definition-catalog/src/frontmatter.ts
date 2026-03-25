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
import type {
  DefScope,
  DefAspect,
  DefDepth,
  DefLifecycle,
  LinkType,
  DefinitionEntryInput,
} from "./types.js";
import { isValidScopeAspect } from "./taxonomy.js";
import { MemoryDefinitionRegistry } from "./registry.js";
import { computeEffectiveConcerns } from "./concern.js";
import type { EffectiveConcerns } from "./types.js";

// ─── Frontmatter 타입 ────────────────────────────────────

/** frontmatter에서 파싱된 link 선언 */
export interface FrontmatterLink {
  readonly target: string;
  readonly type: LinkType;
}

/** frontmatter에서 파싱된 def 블록 */
export interface FrontmatterDef {
  readonly id: string;
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
  readonly lifecycle: DefLifecycle;
  readonly tags?: readonly string[];
  readonly links?: readonly FrontmatterLink[];
  /** 서비스 레지스트리 연결 (serviceId) */
  readonly svc?: string;
}

/** 파싱 결과 */
export interface ParsedDocument {
  /** frontmatter def 블록 */
  readonly def: FrontmatterDef;
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
 */
export function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let currentKey = "";
  let currentObj: Record<string, unknown> = result;
  let inArray = false;
  let arrayKey = "";
  let arrayItems: Record<string, string>[] = [];
  let currentArrayItem: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // 빈 줄, 주석 무시
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // 배열 항목 처리 (- key: value)
    if (inArray && indent >= 4 && trimmed.startsWith("- ")) {
      // 이전 아이템 저장
      if (Object.keys(currentArrayItem).length > 0) {
        arrayItems.push(currentArrayItem);
      }
      currentArrayItem = {};
      const kvMatch = trimmed.slice(2).match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1]] = kvMatch[2].trim();
      }
      continue;
    }

    // 배열 항목 연속 키 (target 다음 줄의 type 등)
    if (inArray && indent >= 6 && !trimmed.startsWith("- ")) {
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        currentArrayItem[kvMatch[1]] = kvMatch[2].trim();
      }
      continue;
    }

    // 배열 끝 감지 (인덴트가 줄었을 때)
    if (inArray && indent < 4) {
      if (Object.keys(currentArrayItem).length > 0) {
        arrayItems.push(currentArrayItem);
        currentArrayItem = {};
      }
      (currentObj as Record<string, unknown>)[arrayKey] = arrayItems;
      inArray = false;
      arrayItems = [];
    }

    // 최상위 키 (indent 0)
    if (indent === 0) {
      const keyMatch = trimmed.match(/^(\w+):\s*$/);
      if (keyMatch) {
        // 중첩 객체 시작
        currentKey = keyMatch[1];
        const nested: Record<string, unknown> = {};
        result[currentKey] = nested;
        currentObj = nested;
        continue;
      }
      // 최상위 스칼라
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        result[kvMatch[1]] = parseScalar(kvMatch[2]);
        currentObj = result;
        continue;
      }
    }

    // 중첩 키 (indent 2)
    if (indent === 2 && currentKey) {
      // 블록 배열 시작 확인 (다음 줄이 - 로 시작하는 경우)
      const keyOnly = trimmed.match(/^(\w+):\s*$/);
      if (keyOnly) {
        inArray = true;
        arrayKey = keyOnly[1];
        arrayItems = [];
        currentArrayItem = {};
        continue;
      }

      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const value = kvMatch[2].trim();
        // 인라인 배열 [a, b, c]
        if (value.startsWith("[") && value.endsWith("]")) {
          currentObj[kvMatch[1]] = value
            .slice(1, -1)
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
        } else {
          currentObj[kvMatch[1]] = parseScalar(value);
        }
        continue;
      }
    }
  }

  // 마지막 배열 항목 정리
  if (inArray) {
    if (Object.keys(currentArrayItem).length > 0) {
      arrayItems.push(currentArrayItem);
    }
    (currentObj as Record<string, unknown>)[arrayKey] = arrayItems;
  }

  return result;
}

function parseScalar(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;
  // 따옴표 제거
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// ─── Frontmatter → DefinitionEntryInput 변환 ────────────

const VALID_SCOPES = new Set(["ui", "feature", "flow", "state", "constraint", "data", "interface"]);
const VALID_DEPTHS = new Set(["overview", "specification", "implementation", "validation"]);
const VALID_LIFECYCLES = new Set(["draft", "review", "approved", "deprecated", "archived"]);
const VALID_LINK_TYPES = new Set(["depends_on", "implements", "refines", "constrains", "traces_to", "contains"]);

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

  return {
    id: id as string,
    scope: scope as DefScope,
    aspect: aspect as DefAspect,
    depth: depth as DefDepth,
    lifecycle: lifecycle as DefLifecycle,
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(svc ? { svc } : {}),
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

  return { def, filePath, body: fm.body };
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

      const def = extractDef(parsed, filePath);
      const relPath = relative(baseDir, filePath);

      registry.register({
        id: def.id,
        title: fm.body.match(/^#\s+(.+)/m)?.[1] ?? def.id,
        scope: def.scope,
        aspect: def.aspect,
        depth: def.depth,
        lifecycle: def.lifecycle,
        tags: def.tags ? [...def.tags] : undefined,
        ref: relPath,
        serviceId: def.svc,
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
