// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * prefix-stamp.ts — prefix 표식 자동 생성·검증·탐색.
 *
 * SDK 함수 호출을 앵커로 삼아 // @prefix 스탬프를 코드에 삽입한다.
 * version resolve 우선순위:
 *   1. ServiceVersionManifest (--service 지정 시)
 *   2. VERSION_META.prefixVersions (codegen 생성물이 있으면)
 *   3. latestPrefixVersion (폴백)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, resolve, relative, join } from "node:path";
import type { Catalog } from "@qa-sdk/core";
import { latestPrefixVersion } from "@qa-sdk/core";
import { getServiceUrl } from "../lib/service-profile.js";

// ── Version Resolver ─────────────────────────────────────────────────────────

/**
 * prefix version을 결정하는 resolve 체계.
 * 우선순위: manifest → versionMeta → latestPrefixVersion
 */
interface VersionResolver {
  resolve(catalog: Catalog, prefixId: string): string;
  readonly source: string;
}

/** ServiceVersionManifest 기반 resolver */
function createManifestResolver(
  prefixes: Record<string, string>,
  serviceId: string,
): VersionResolver {
  return {
    resolve(catalog, prefixId) {
      return prefixes[prefixId] ?? latestPrefixVersion(catalog, prefixId);
    },
    source: `manifest:${serviceId}`,
  };
}

/** VERSION_META.prefixVersions 기반 resolver */
function createVersionMetaResolver(
  prefixVersions: Record<string, string>,
): VersionResolver {
  return {
    resolve(catalog, prefixId) {
      return prefixVersions[prefixId] ?? latestPrefixVersion(catalog, prefixId);
    },
    source: "VERSION_META",
  };
}

/** 폴백: latestPrefixVersion */
function createLatestResolver(): VersionResolver {
  return {
    resolve: latestPrefixVersion,
    source: "latest",
  };
}

/**
 * version resolver를 구축한다.
 * --service 옵션 → 매니페스트 탐색
 * VERSION_META 발견 → prefixVersions 사용
 * 없으면 → latest 폴백
 */
function buildVersionResolver(
  catalog: Catalog,
  serviceId?: string,
): VersionResolver {
  // 1. --service 지정 시: 로컬 → registry 순서로 매니페스트 탐색
  if (serviceId) {
    const manifest = loadLocalManifest(serviceId) ?? fetchRegistryManifest(serviceId);
    if (manifest) {
      return createManifestResolver(manifest, serviceId);
    }
    console.log(`  서비스 "${serviceId}" 매니페스트 미발견 — latest 폴백`);
  }

  // 2. VERSION_META 탐색: 프로젝트 내 codegen 생성물에서 prefixVersions 로드
  const versionMeta = findVersionMeta();
  if (versionMeta) {
    return createVersionMetaResolver(versionMeta);
  }

  // 3. 폴백
  return createLatestResolver();
}

/**
 * 프로젝트에서 VERSION_META를 찾는다.
 * demo-types/src/prefix-ids.ts 또는 generated/prefix-ids.ts 등을 탐색.
 */
function findVersionMeta(): Record<string, string> | null {
  const candidates = [
    resolve(process.cwd(), "packages/demo-types/src/prefix-ids.ts"),
    resolve(process.cwd(), "packages/demo-types/dist/prefix-ids.js"),
    resolve(process.cwd(), "generated/prefix-ids.ts"),
    resolve(process.cwd(), "generated/prefix-ids.js"),
    resolve(process.cwd(), "src/generated/prefix-ids.ts"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const content = readFileSync(candidate, "utf-8");
      // prefixVersions 오브젝트를 정규식으로 추출
      const match = content.match(/prefixVersions:\s*\{([^}]+)\}/s);
      if (!match) continue;

      const entries: Record<string, string> = {};
      const entryRe = /"([\w-]+)":\s*"([\w.]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = entryRe.exec(match[1])) !== null) {
        entries[m[1]] = m[2];
      }
      if (Object.keys(entries).length > 0) {
        return entries;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 서비스별 로컬 매니페스트를 탐색한다.
 * ~/.qa-sdk/manifests/{serviceId}.json 또는 프로젝트 내 manifest 파일을 탐색.
 */
function loadLocalManifest(serviceId: string): Record<string, string> | null {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const candidates = [
    resolve(homeDir, `.qa-sdk/manifests/${serviceId}.json`),
    resolve(process.cwd(), `.qa-sdk/manifests/${serviceId}.json`),
    resolve(process.cwd(), `manifests/${serviceId}.json`),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const content = readFileSync(candidate, "utf-8");
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const prefixVersions = parsed.prefixVersions;
      if (prefixVersions && typeof prefixVersions === "object" && !Array.isArray(prefixVersions)) {
        return prefixVersions as Record<string, string>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * registry-service에서 서비스 매니페스트를 fetch한다.
 * 실패 시 null 반환 (fail-open).
 */
function fetchRegistryManifest(serviceId: string): Record<string, string> | null {
  try {
    const registryUrl = getServiceUrl("registry-service");
    const url = `${registryUrl}/api/services/${serviceId}/manifest`;
    // 동기 fetch — CLI이므로 허용. AbortSignal.timeout 적용.
    const resp = fetchSync(url);
    if (!resp) return null;
    const parsed = JSON.parse(resp) as Record<string, unknown>;
    const prefixes = parsed.prefixVersions ?? parsed.prefixes;
    if (prefixes && typeof prefixes === "object" && !Array.isArray(prefixes)) {
      console.log(`  registry manifest 로드: ${serviceId}`);
      return prefixes as Record<string, string>;
    }
  } catch {
    // registry 미실행 또는 네트워크 오류 — silent fail
  }
  return null;
}

/** 동기 HTTP GET — CLI 전용. 5초 타임아웃. */
function fetchSync(url: string): string | null {
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    return execSync(`curl -sf --max-time 5 "${url}"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

// ── 확장자별 주석 접두사 ──────────────────────────────────────────────────────

const COMMENT_PREFIX: Record<string, string> = {
  ".ts": "//",
  ".tsx": "//",
  ".js": "//",
  ".jsx": "//",
  ".mts": "//",
  ".mjs": "//",
  ".go": "//",
  ".rs": "//",
  ".java": "//",
  ".kt": "//",
  ".swift": "//",
  ".c": "//",
  ".cpp": "//",
  ".cs": "//",
  ".py": "#",
  ".sh": "#",
  ".bash": "#",
  ".zsh": "#",
  ".rb": "#",
  ".yaml": "#",
  ".yml": "#",
  ".toml": "#",
  ".r": "#",
  ".lua": "--",
  ".sql": "--",
  ".hs": "--",
};

// ── SDK 앵커 함수 정의 ────────────────────────────────────────────────────────

/**
 * SDK 함수별 prefix ID + dims 추출 규칙.
 *
 * prefixArgPosition:
 *   "object-key-N" → N번째 인자가 오브젝트 리터럴이고 키가 prefix ID
 *   "string-N"     → N번째 인자가 문자열 리터럴 prefix ID
 */
interface AnchorDef {
  /** SDK 함수 이름 (메서드 포함: ".track", "browserTrack" 등) */
  readonly patterns: readonly string[];
  /** prefix ID 추출 방식 */
  readonly prefixArg: "object-key-1" | "object-key-2" | "string-1" | "string-2";
}

/**
 * DataObjectBinding 상수에서 prefixId를 추출하는 특수 앵커.
 * codegen이 생성한 `*_BINDING` 상수의 `prefixId: "..."` 패턴을 탐지.
 */
interface BindingAnchorDef {
  readonly patterns: readonly string[];
  readonly prefixArg: "binding-prefixId";
}

const BINDING_ANCHORS: readonly BindingAnchorDef[] = [
  // codegen 생성 바인딩 상수: `prefixId: "order_event"`
  { patterns: ["_BINDING"], prefixArg: "binding-prefixId" },
];

const ANCHORS: readonly AnchorDef[] = [
  // prefix 전용 SDK 함수만 앵커로 사용
  // .encode() / .decode()는 WeightedIndex, BitIndex, Protobuf 등에도 있어 노이즈가 큼
  { patterns: [".track("], prefixArg: "object-key-1" },
  { patterns: [".emitWithCoords("], prefixArg: "object-key-2" },
  { patterns: ["browserTrack("], prefixArg: "object-key-2" },
  { patterns: ["encodePrefix("], prefixArg: "string-2" },
  { patterns: ["decodePrefix("], prefixArg: "string-2" },
  { patterns: ["encodePrefixByValue("], prefixArg: "string-2" },
  { patterns: ["encodeBySegment("], prefixArg: "string-2" },
  { patterns: ["decodeBySegment("], prefixArg: "string-1" },
];

// ── 제외 경로 패턴 ───────────────────────────────────────────────────────────

const EXCLUDE_PATTERNS = [
  /\.test\.\w+$/,
  /\.spec\.\w+$/,
  /__tests__\//,
  /node_modules\//,
  /\/dist\//,
  // SDK 구현 내부
  /browser-codec\/src\/browser-codec\.\w+$/,
  /browser-sdk\/src\/monitor\.\w+$/,
  /context\/src\/qa-context\.\w+$/,
  /core\/src\/catalog\/runtime\.\w+$/,
  // SSOT
  /prefix-mapping\.\w+$/,
  /auto-track\.\w+$/,
  /demo-catalog\.\w+$/,
  // stamp 도구 자체
  /prefix-stamp\.\w+$/,
  // 빌드 산출물
  /\/public\//,
  /\.wrangler\//,
  // codegen 생성물
  /demo-types\/src\//,
];

function isExcluded(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath));
}

// ── 스탬프 파싱 ──────────────────────────────────────────────────────────────

interface ParsedStamp {
  readonly prefixId: string;
  readonly version: string | undefined;
  /** product 모델: dims */
  readonly dims: readonly { label: string; index: number }[];
  /** sum 모델: model/segmentId/consumes */
  readonly model?: "sum";
  readonly segmentId?: string;
  readonly consumes?: readonly string[];
  readonly raw: string;
  readonly lineIndex: number;
}

const STAMP_RE = /@prefix\s+([\w-]+)(?::([\w.]+))?(?:\s+—\s+(.*))?/;
const DIMS_RE = /dims:\s*\[([^\]]+)\]/;
const DIM_ITEM_RE = /([\w-]+):(\d+)/g;
const SUM_MODEL_RE = /model:sum\s+seg:([\w-]+)\s+consumes:\[([^\]]+)\]/;

function parseStamp(line: string, lineIndex: number): ParsedStamp | null {
  const m = line.match(STAMP_RE);
  if (!m) return null;

  const meta = m[3] || "";

  // sum 모델 파싱 시도
  const sumMatch = meta.match(SUM_MODEL_RE);
  if (sumMatch) {
    return {
      prefixId: m[1],
      version: m[2] || undefined,
      dims: [],
      model: "sum",
      segmentId: sumMatch[1],
      consumes: sumMatch[2].split(",").map(s => s.trim()),
      raw: line,
      lineIndex,
    };
  }

  // product 모델 (기존)
  const dims: { label: string; index: number }[] = [];
  const dm = meta.match(DIMS_RE);
  if (dm) {
    let im: RegExpExecArray | null;
    while ((im = DIM_ITEM_RE.exec(dm[1])) !== null) {
      dims.push({ label: im[1], index: parseInt(im[2]) });
    }
  }

  return {
    prefixId: m[1],
    version: m[2] || undefined,
    dims,
    raw: line,
    lineIndex,
  };
}

// ── prefix ID 추출 (코드에서) ────────────────────────────────────────────────

/**
 * 간이 추출: 문자열 리터럴에서 prefix ID 추출.
 * `"cart_event"` 또는 `'cart_event'` 형태.
 */
function extractStringArg(code: string, funcCall: string, argPos: number): string | null {
  const idx = code.indexOf(funcCall);
  if (idx < 0) return null;

  const afterFunc = code.slice(idx + funcCall.length);
  // N번째 인자까지 콤마로 스킵
  let remaining = afterFunc;
  for (let i = 1; i < argPos; i++) {
    const commaIdx = findCommaOutsideParens(remaining);
    if (commaIdx < 0) return null;
    remaining = remaining.slice(commaIdx + 1);
  }

  const strMatch = remaining.match(/^\s*["']([\w-]+)["']/);
  return strMatch ? strMatch[1] : null;
}

/**
 * 조건 상수 패턴에서 prefix ID 후보를 모두 추출.
 * `x ? "build_event" : "test_event"` → ["build_event", "test_event"]
 * 변수에 대입된 삼항 연산자도 앞 몇 행에서 탐지.
 */
function extractConditionalPrefixIds(
  lines: string[],
  callLine: number,
  catalog: Catalog,
): string[] {
  // 호출부 앞 5행 ~ 호출부까지 범위에서 삼항 연산자 패턴 탐색
  const start = Math.max(0, callLine - 5);
  const context = lines.slice(start, callLine + 1).join("\n");

  // 패턴: `= ... ? "X" : "Y"` 또는 `=== ... ? "X" : "Y"`
  const ternaryRe = /\?\s*["']([\w-]+)["']\s*:\s*["']([\w-]+)["']/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = ternaryRe.exec(context)) !== null) {
    if (catalog.prefixes[m[1]]) ids.push(m[1]);
    if (catalog.prefixes[m[2]]) ids.push(m[2]);
  }
  return [...new Set(ids)];
}

/**
 * 간이 추출: 오브젝트 리터럴 키에서 prefix ID 추출.
 * `{ service: ..., page_view: ... }` → ["service", "page_view"]
 */
function extractObjectKeys(code: string, funcCall: string, argPos: number): string[] {
  const idx = code.indexOf(funcCall);
  if (idx < 0) return [];

  const afterFunc = code.slice(idx + funcCall.length);
  let remaining = afterFunc;
  for (let i = 1; i < argPos; i++) {
    const commaIdx = findCommaOutsideParens(remaining);
    if (commaIdx < 0) return [];
    remaining = remaining.slice(commaIdx + 1);
  }

  // 오브젝트 리터럴 시작 찾기
  const braceIdx = remaining.indexOf("{");
  if (braceIdx < 0) return [];

  // 간이 키 추출: 오브젝트 내에서 `key:` 또는 `key :` 패턴
  const objContent = extractBraceContent(remaining, braceIdx);
  if (!objContent) return [];

  const keys: string[] = [];
  const keyRe = /(?:^|,|\{)\s*([\w-]+)\s*:/g;
  let km: RegExpExecArray | null;
  while ((km = keyRe.exec(objContent)) !== null) {
    keys.push(km[1]);
  }
  return keys;
}

function findCommaOutsideParens(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(" || s[i] === "{" || s[i] === "[") depth++;
    else if (s[i] === ")" || s[i] === "}" || s[i] === "]") depth--;
    else if (s[i] === "," && depth === 0) return i;
  }
  return -1;
}

function extractBraceContent(s: string, startIdx: number): string | null {
  let depth = 0;
  for (let i = startIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(startIdx, i + 1);
    }
  }
  return null;
}

// ── resolve: 카탈로그에서 version + index ────────────────────────────────────

function resolveStampLine(
  catalog: Catalog,
  prefixId: string,
  commentPrefix: string,
  indent: string,
  versionResolver: VersionResolver,
  segmentId?: string,
): string | null {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) return null;

  const version = versionResolver.resolve(catalog, prefixId);

  // sum 모델 — 세그먼트별 스탬프
  if (prefix.addressModel === "sum" && segmentId) {
    const vdef = prefix.versions.find(v => v.version === version);
    const seg = vdef?.segments?.find(s => s.segmentId === segmentId);
    if (!seg) return null;
    const consumesStr = seg.consumes.join(",");
    return `${indent}${commentPrefix} @prefix ${prefixId}:${version} — model:sum seg:${segmentId} consumes:[${consumesStr}]`;
  }

  // sum 모델이지만 segmentId 미지정 → 모든 세그먼트 스탬프 (첫 번째만)
  if (prefix.addressModel === "sum") {
    const vdef = prefix.versions.find(v => v.version === version);
    const seg = vdef?.segments?.[0];
    if (seg) {
      const consumesStr = seg.consumes.join(",");
      return `${indent}${commentPrefix} @prefix ${prefixId}:${version} — model:sum seg:${seg.segmentId} consumes:[${consumesStr}]`;
    }
  }

  // product 모델 (기존)
  const labels = prefix.labels;
  const dimsStr = labels.map((label, i) => `${label}:${i}`).join(", ");
  return `${indent}${commentPrefix} @prefix ${prefixId}:${version} — dims: [${dimsStr}]`;
}

/** sum prefix의 모든 세그먼트에 대한 스탬프 행 생성 */
function resolveAllSegmentStampLines(
  catalog: Catalog,
  prefixId: string,
  commentPrefix: string,
  indent: string,
  versionResolver: VersionResolver,
): string[] {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix || prefix.addressModel !== "sum") return [];

  const version = versionResolver.resolve(catalog, prefixId);
  const vdef = prefix.versions.find(v => v.version === version);
  if (!vdef?.segments) return [];

  return vdef.segments.map(seg => {
    const consumesStr = seg.consumes.join(",");
    return `${indent}${commentPrefix} @prefix ${prefixId}:${version} — model:sum seg:${seg.segmentId} consumes:[${consumesStr}]`;
  });
}

// ── 앵커 탐지 + 스탬프 생성 ──────────────────────────────────────────────────

interface StampAction {
  readonly prefixId: string | null;
  readonly insertBeforeLine: number;
  readonly stampLine: string | null;
  /** 리터럴이면 resolved, 변수면 unresolved */
  readonly status: "resolved" | "unresolved";
  /** SDK 함수 패턴 (디버그/리포트용) */
  readonly anchorPattern: string;
  /** 호출부 행 번호 */
  readonly callLine: number;
}

function findAnchorsInFile(
  lines: string[],
  catalog: Catalog,
  commentPrefix: string,
  versionResolver: VersionResolver,
): StampAction[] {
  const actions: StampAction[] = [];
  const fullText = lines.join("\n");

  for (const anchor of ANCHORS) {
    for (const pattern of anchor.patterns) {
      let searchFrom = 0;
      while (true) {
        const idx = fullText.indexOf(pattern, searchFrom);
        if (idx < 0) break;
        searchFrom = idx + pattern.length;

        const lineIndex = fullText.slice(0, idx).split("\n").length - 1;
        const contextEnd = Math.min(lineIndex + 10, lines.length);
        const context = lines.slice(lineIndex, contextEnd).join("\n");

        // prefix ID 추출 시도
        let prefixIds: string[] = [];
        if (anchor.prefixArg === "string-1") {
          const id = extractStringArg(context, pattern, 1);
          if (id) prefixIds = [id];
        } else if (anchor.prefixArg === "string-2") {
          const id = extractStringArg(context, pattern, 2);
          if (id) prefixIds = [id];
        } else if (anchor.prefixArg === "object-key-1") {
          prefixIds = extractObjectKeys(context, pattern, 1);
        } else if (anchor.prefixArg === "object-key-2") {
          prefixIds = extractObjectKeys(context, pattern, 2);
        }

        const insertLine = findInsertLine(lines, lineIndex);
        const indent = lines[insertLine]?.match(/^(\s*)/)?.[1] ?? "";

        // 카탈로그에 존재하는 리터럴 prefix → resolved
        const validIds = prefixIds.filter((id) => catalog.prefixes[id]);

        if (validIds.length > 0) {
          for (const prefixId of validIds) {
            const stampLine = resolveStampLine(catalog, prefixId, commentPrefix, indent, versionResolver);
            if (stampLine) {
              actions.push({
                prefixId,
                insertBeforeLine: insertLine,
                stampLine,
                status: "resolved",
                anchorPattern: pattern,
                callLine: lineIndex,
              });
            }
          }
        } else {
          // 리터럴이 없음 → 조건 상수 패턴 시도
          const conditionalIds = extractConditionalPrefixIds(lines, lineIndex, catalog);
          if (conditionalIds.length > 0) {
            for (const prefixId of conditionalIds) {
              const stampLine = resolveStampLine(catalog, prefixId, commentPrefix, indent, versionResolver);
              if (stampLine) {
                actions.push({
                  prefixId,
                  insertBeforeLine: insertLine,
                  stampLine,
                  status: "resolved",
                  anchorPattern: pattern,
                  callLine: lineIndex,
                });
              }
            }
          } else {
            // 변수 사용으로 간주 → unresolved
            actions.push({
              prefixId: null,
              insertBeforeLine: insertLine,
              stampLine: null,
              status: "unresolved",
              anchorPattern: pattern,
              callLine: lineIndex,
            });
          }
        }
      }
    }
  }

  // 바인딩 앵커: `*_BINDING` 상수가 import되거나 사용되는 파일에서 prefixId 추출
  for (const anchor of BINDING_ANCHORS) {
    for (const pattern of anchor.patterns) {
      // import 문에서 바인딩 상수 사용 감지
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        // import { ORDERS_BINDING } from "./data-objects" 패턴
        if (!line.includes(pattern)) continue;
        // 같은 파일에서 prefixId 리터럴 추출 (바인딩 정의 파일)
        const prefixMatch = line.match(/prefixId:\s*["']([\w-]+)["']/);
        if (prefixMatch) {
          const prefixId = prefixMatch[1];
          if (!catalog.prefixes[prefixId]) continue;
          const insertLine = findInsertLine(lines, lineIndex);
          const indent = lines[insertLine]?.match(/^(\s*)/)?.[1] ?? "";
          const stampLine = resolveStampLine(catalog, prefixId, commentPrefix, indent, versionResolver);
          if (stampLine) {
            actions.push({
              prefixId,
              insertBeforeLine: insertLine,
              stampLine,
              status: "resolved",
              anchorPattern: pattern,
              callLine: lineIndex,
            });
          }
        }
        // import 구문에서 바인딩 변수명 감지 → 파일 내 prefixId 찾기
        if (/import\s*\{.*_BINDING/.test(line)) {
          const bindingNames = [...line.matchAll(/([\w]+_BINDING)/g)].map(m => m[1]);
          for (const bindingName of bindingNames) {
            // 파일 전체에서 해당 바인딩의 .prefixId 참조 찾기
            const prefixIdLine = fullText.match(new RegExp(`${bindingName}\\.prefixId`));
            if (!prefixIdLine) continue;
            // 바인딩이 참조되는 위치에 스탬프 — import 행에 삽입
            // 주변에서 prefixId 리터럴 찾기 (codegen 생성 파일이면)
            const defMatch = fullText.match(new RegExp(`const\\s+${bindingName}[\\s\\S]*?prefixId:\\s*["'](\\w+)["']`));
            if (!defMatch || !catalog.prefixes[defMatch[1]]) continue;
            const insertLine2 = findInsertLine(lines, lineIndex);
            const indent2 = lines[insertLine2]?.match(/^(\s*)/)?.[1] ?? "";
            const stampLine2 = resolveStampLine(catalog, defMatch[1], commentPrefix, indent2, versionResolver);
            if (stampLine2) {
              actions.push({
                prefixId: defMatch[1],
                insertBeforeLine: insertLine2,
                stampLine: stampLine2,
                status: "resolved",
                anchorPattern: `${pattern}(${bindingName})`,
                callLine: lineIndex,
              });
            }
          }
        }
      }
    }
  }

  return actions;
}

/**
 * 스탬프 삽입 행 결정.
 * 호출부를 포함하는 함수/클래스 선언을 찾아서 그 위에 삽입.
 * 못 찾으면 호출부 바로 위.
 */
function findInsertLine(lines: string[], callLine: number): number {
  // 호출부에서 위로 올라가며 function/class/const 선언 찾기
  for (let i = callLine; i >= Math.max(0, callLine - 20); i--) {
    const line = lines[i];
    if (
      /^\s*(export\s+)?(async\s+)?function\s/.test(line) ||
      /^\s*(export\s+)?class\s/.test(line) ||
      /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/.test(line)
    ) {
      return i;
    }
  }
  return callLine;
}

// ── stamp 명령 ───────────────────────────────────────────────────────────────

export interface StampOptions {
  readonly update?: boolean;
  readonly dryRun?: boolean;
  readonly service?: string;
  readonly paths?: string[];
}

export function prefixStamp(catalog: Catalog, opts: StampOptions = {}): void {
  const versionResolver = buildVersionResolver(catalog, opts.service);
  console.log(`version resolve: ${versionResolver.source}`);

  const targetPaths = opts.paths?.length ? opts.paths : [process.cwd()];
  const files = collectFiles(targetPaths);

  let totalStamped = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalUnresolved = 0;
  const unresolvedSites: { file: string; line: number; anchor: string }[] = [];

  for (const filePath of files) {
    if (isExcluded(filePath)) continue;

    const ext = extname(filePath);
    const commentPrefix = COMMENT_PREFIX[ext];
    if (!commentPrefix) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = relative(process.cwd(), filePath);

    // 1. 기존 스탬프 수집
    const existingStamps: ParsedStamp[] = [];
    for (let i = 0; i < lines.length; i++) {
      const stamp = parseStamp(lines[i], i);
      if (stamp) existingStamps.push(stamp);
    }

    // 2. 수동 힌트 처리 (version 없는 스탬프 → resolve)
    if (opts.update) {
      let changed = false;
      for (const stamp of existingStamps) {
        const newStamp = resolveStampLine(
          catalog,
          stamp.prefixId,
          commentPrefix,
          lines[stamp.lineIndex].match(/^(\s*)/)?.[1] ?? "",
          versionResolver,
        );
        if (newStamp && newStamp !== lines[stamp.lineIndex]) {
          if (opts.dryRun) {
            console.log(`  ${rel}:${stamp.lineIndex + 1}`);
            console.log(`    ${lines[stamp.lineIndex].trim()}`);
            console.log(`    → ${newStamp.trim()}`);
          } else {
            lines[stamp.lineIndex] = newStamp;
            changed = true;
          }
          totalUpdated++;
        }
      }
      if (changed) {
        writeFileSync(filePath, lines.join("\n"), "utf-8");
      }
    }

    // 3. 새 앵커 탐지 + 스탬프 삽입
    const actions = findAnchorsInFile(lines, catalog, commentPrefix, versionResolver);

    // 이미 스탬프된 prefix는 건너뛰기 (중복 방지)
    const stampedPrefixesAtLine = new Map<number, Set<string>>();
    for (const stamp of existingStamps) {
      for (let offset = 0; offset <= 25; offset++) {
        const key = stamp.lineIndex + offset;
        if (!stampedPrefixesAtLine.has(key)) stampedPrefixesAtLine.set(key, new Set());
        stampedPrefixesAtLine.get(key)!.add(stamp.prefixId);
      }
    }

    // unresolved 수집 (기존 스탬프로 커버된 곳은 제외)
    for (const action of actions) {
      if (action.status === "unresolved") {
        // 해당 위치에 이미 수동 힌트 스탬프가 있으면 건너뜀
        const covered = stampedPrefixesAtLine.has(action.insertBeforeLine);
        if (!covered) {
          totalUnresolved++;
          unresolvedSites.push({
            file: rel,
            line: action.callLine + 1,
            anchor: action.anchorPattern,
          });
        }
        continue;
      }
    }

    const insertions: { line: number; content: string }[] = [];
    for (const action of actions) {
      if (action.status !== "resolved" || !action.prefixId || !action.stampLine) continue;
      const covered = stampedPrefixesAtLine.get(action.insertBeforeLine);
      if (covered?.has(action.prefixId)) {
        totalSkipped++;
        continue;
      }
      insertions.push({ line: action.insertBeforeLine, content: action.stampLine });
      if (!stampedPrefixesAtLine.has(action.insertBeforeLine)) {
        stampedPrefixesAtLine.set(action.insertBeforeLine, new Set());
      }
      stampedPrefixesAtLine.get(action.insertBeforeLine)!.add(action.prefixId);
    }

    if (insertions.length > 0) {
      if (opts.dryRun) {
        for (const ins of insertions) {
          console.log(`  ${relative(process.cwd(), filePath)}:${ins.line + 1}`);
          console.log(`    + ${ins.content.trim()}`);
        }
      } else {
        // 뒤에서부터 삽입 (행 번호 안 밀리게)
        const sorted = insertions.sort((a, b) => b.line - a.line);
        for (const ins of sorted) {
          lines.splice(ins.line, 0, ins.content);
        }
        writeFileSync(filePath, lines.join("\n"), "utf-8");
      }
      totalStamped += insertions.length;
    }
  }

  console.log(
    `prefix stamp: ${totalStamped} 삽입, ${totalUpdated} 갱신, ${totalSkipped} 중복 건너뜀, ${totalUnresolved} 힌트 필요`,
  );

  if (unresolvedSites.length > 0) {
    console.log(`\n힌트 필요 (변수 prefix ID — 수동 // @prefix <id> 추가):`);
    for (const site of unresolvedSites) {
      console.log(`  ${site.file}:${site.line} — ${site.anchor.replace("(", "")}`);
    }
  }
}

// ── drift 명령 ───────────────────────────────────────────────────────────────

interface DriftResult {
  readonly file: string;
  readonly line: number;
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
}

export function prefixDrift(catalog: Catalog, paths?: string[]): void {
  const targetPaths = paths?.length ? paths : [process.cwd()];
  const files = collectFiles(targetPaths);
  const results: DriftResult[] = [];

  for (const filePath of files) {
    if (isExcluded(filePath)) continue;
    const ext = extname(filePath);
    if (!COMMENT_PREFIX[ext]) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = relative(process.cwd(), filePath);

    for (let i = 0; i < lines.length; i++) {
      const stamp = parseStamp(lines[i], i);
      if (!stamp) continue;

      const prefix = catalog.prefixes[stamp.prefixId];
      if (!prefix) {
        results.push({
          file: rel,
          line: i + 1,
          severity: "error",
          code: "unknown-prefix",
          message: `카탈로그에 없는 prefix: ${stamp.prefixId}`,
        });
        continue;
      }

      const latestVer = latestPrefixVersion(catalog, stamp.prefixId);

      // version-behind
      if (stamp.version && stamp.version !== latestVer) {
        results.push({
          file: rel,
          line: i + 1,
          severity: "warning",
          code: "version-behind",
          message: `${stamp.prefixId} — 표식 ${stamp.version}, 최신 ${latestVer}`,
        });
      }

      const checkVersion = stamp.version || latestVer;
      const labels = prefix.labels;

      // sum 모델 검증
      if (stamp.model === "sum" && stamp.segmentId) {
        const vdef = prefix.versions.find(v => v.version === checkVersion);
        const segments = vdef?.segments;

        if (!segments) {
          results.push({
            file: rel, line: i + 1, severity: "error",
            code: "no-segments",
            message: `${stamp.prefixId}:${checkVersion} — segments 미정의 (addressModel: sum)`,
          });
        } else {
          const seg = segments.find(s => s.segmentId === stamp.segmentId);
          if (!seg) {
            results.push({
              file: rel, line: i + 1, severity: "error",
              code: "segment-removed",
              message: `${stamp.prefixId}:${checkVersion} — seg "${stamp.segmentId}" 삭제됨`,
            });
          } else if (stamp.consumes) {
            // consumes 변경 검증
            const actualConsumes = seg.consumes.join(",");
            const stampConsumes = stamp.consumes.join(",");
            if (actualConsumes !== stampConsumes) {
              results.push({
                file: rel, line: i + 1, severity: "error",
                code: "consumes-changed",
                message: `${stamp.prefixId}:${checkVersion} seg:${stamp.segmentId} — 표식 [${stampConsumes}], 실제 [${actualConsumes}]`,
              });
            }
          }
        }
        continue;
      }

      // product 모델 dim 검증 (기존)
      for (const dim of stamp.dims) {
        const actualIndex = labels.indexOf(dim.label);
        if (actualIndex < 0) {
          results.push({
            file: rel,
            line: i + 1,
            severity: "error",
            code: "label-removed",
            message: `${stamp.prefixId}:${checkVersion} — dim "${dim.label}" 삭제됨`,
          });
        } else if (actualIndex !== dim.index) {
          results.push({
            file: rel,
            line: i + 1,
            severity: "error",
            code: "index-mismatch",
            message: `${stamp.prefixId}:${checkVersion} ${dim.label} — 표식 index:${dim.index}, 실제 index:${actualIndex}`,
          });
        }
      }
    }
  }

  // 출력
  if (results.length === 0) {
    console.log("prefix drift: 불일치 없음 ✓");
    return;
  }

  const errors = results.filter((r) => r.severity === "error");
  const warnings = results.filter((r) => r.severity === "warning");
  const infos = results.filter((r) => r.severity === "info");

  for (const r of results) {
    const tag =
      r.severity === "error" ? "ERROR" : r.severity === "warning" ? "WARNING" : "INFO";
    console.log(`${tag}  ${r.code}: ${r.message}`);
    console.log(`  → ${r.file}:${r.line}`);
  }

  console.log(
    `\nprefix drift: ${errors.length} error, ${warnings.length} warning, ${infos.length} info`,
  );

  if (errors.length > 0) process.exitCode = 1;
}

// ── find 명령 ────────────────────────────────────────────────────────────────

export function prefixFind(
  catalog: Catalog,
  prefixId?: string,
  opts?: { dim?: string; version?: string; summary?: boolean; segment?: string; model?: string },
): void {
  const files = collectFiles([process.cwd()]);
  const matches: { file: string; line: number; stamp: ParsedStamp }[] = [];

  for (const filePath of files) {
    if (isExcluded(filePath)) continue;
    const ext = extname(filePath);
    if (!COMMENT_PREFIX[ext]) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = relative(process.cwd(), filePath);

    for (let i = 0; i < lines.length; i++) {
      const stamp = parseStamp(lines[i], i);
      if (!stamp) continue;

      // 필터
      if (prefixId && stamp.prefixId !== prefixId) continue;
      if (opts?.version && stamp.version !== opts.version) continue;
      if (opts?.dim && !stamp.dims.some((d) => d.label === opts.dim)) continue;
      if (opts?.segment && stamp.segmentId !== opts.segment) continue;
      if (opts?.model === "sum" && stamp.model !== "sum") continue;
      if (opts?.model === "product" && stamp.model === "sum") continue;

      matches.push({ file: rel, line: i + 1, stamp });
    }
  }

  if (opts?.summary) {
    // prefix별 카운트
    const counts = new Map<string, number>();
    for (const m of matches) {
      counts.set(m.stamp.prefixId, (counts.get(m.stamp.prefixId) || 0) + 1);
    }
    console.log("prefix 사용 현황:");
    for (const [id, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id}: ${count}곳`);
    }
    return;
  }

  if (matches.length === 0) {
    console.log(prefixId ? `"${prefixId}" 스탬프 없음` : "스탬프 없음");
    return;
  }

  for (const m of matches) {
    let detail: string;
    if (m.stamp.model === "sum") {
      detail = ` — model:sum seg:${m.stamp.segmentId} consumes:[${m.stamp.consumes?.join(",") ?? ""}]`;
    } else {
      detail = m.stamp.dims.length > 0
        ? ` — dims: [${m.stamp.dims.map((d) => `${d.label}:${d.index}`).join(", ")}]`
        : "";
    }
    console.log(
      `  ${m.file}:${m.line} — ${m.stamp.prefixId}:${m.stamp.version || "?"}${detail}`,
    );
  }
  console.log(`\n${matches.length}건`);
}

// ── migrate 명령 ─────────────────────────────────────────────────────────────

export function prefixMigrate(
  catalog: Catalog,
  prefixId: string,
  fromVersion: string,
  toVersion: string,
  opts?: { dryRun?: boolean },
): void {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) {
    console.error(`카탈로그에 없는 prefix: ${prefixId}`);
    return;
  }

  // to version의 labels/segments로 새 스탬프 계산
  const labels = prefix.labels;
  const newDimsStr = labels.map((label, i) => `${label}:${i}`).join(", ");

  // sum 모델: to version의 세그먼트 맵
  const toVdef = prefix.versions.find(v => v.version === toVersion);
  const toSegMap = new Map(
    (toVdef?.segments ?? []).map(s => [s.segmentId, s]),
  );

  const files = collectFiles([process.cwd()]);
  const stampRe = new RegExp(
    `@prefix\\s+${escapeForRegex(prefixId)}:${escapeForRegex(fromVersion)}(\\s+—\\s+.*)?\$`,
  );

  let count = 0;

  for (const filePath of files) {
    if (isExcluded(filePath)) continue;
    const ext = extname(filePath);
    const cp = COMMENT_PREFIX[ext];
    if (!cp) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = relative(process.cwd(), filePath);
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      if (!stampRe.test(lines[i])) continue;

      const indent = lines[i].match(/^(\s*)/)?.[1] ?? "";
      const parsed = parseStamp(lines[i], i);
      let newLine: string;

      if (parsed?.model === "sum" && parsed.segmentId) {
        // sum 모델: 세그먼트별 스탬프 갱신
        const toSeg = toSegMap.get(parsed.segmentId);
        if (toSeg) {
          const consumesStr = toSeg.consumes.join(",");
          newLine = `${indent}${cp} @prefix ${prefixId}:${toVersion} — model:sum seg:${parsed.segmentId} consumes:[${consumesStr}]`;
        } else {
          // 세그먼트 제거됨
          console.log(`  ⚠ ${rel}:${i + 1} — seg "${parsed.segmentId}" v2에서 제거됨`);
          continue;
        }
      } else {
        // product 모델 (기존)
        newLine = `${indent}${cp} @prefix ${prefixId}:${toVersion} — dims: [${newDimsStr}]`;
      }

      if (opts?.dryRun) {
        console.log(`  ${rel}:${i + 1}`);
        console.log(`    ${lines[i].trim()}`);
        console.log(`    → ${newLine.trim()}`);
      } else {
        lines[i] = newLine;
        changed = true;
      }
      count++;
    }

    if (changed) {
      writeFileSync(filePath, lines.join("\n"), "utf-8");
    }
  }

  console.log(`prefix migrate: ${prefixId} ${fromVersion}→${toVersion} — ${count}건 ${opts?.dryRun ? "(dry-run)" : "갱신"}`);
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── impact 명령 ──────────────────────────────────────────────────────────────

export function prefixImpact(catalog: Catalog, prefixId: string): void {
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) {
    console.error(`카탈로그에 없는 prefix: ${prefixId}`);
    return;
  }

  const files = collectFiles([process.cwd()]);
  const stamps: { file: string; line: number; stamp: ParsedStamp }[] = [];

  for (const filePath of files) {
    if (isExcluded(filePath)) continue;
    const ext = extname(filePath);
    if (!COMMENT_PREFIX[ext]) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const rel = relative(process.cwd(), filePath);

    for (let i = 0; i < lines.length; i++) {
      const stamp = parseStamp(lines[i], i);
      if (stamp && stamp.prefixId === prefixId) {
        stamps.push({ file: rel, line: i + 1, stamp });
      }
    }
  }

  // prefix 정보 출력
  const latestVer = latestPrefixVersion(catalog, prefixId);
  const labels = prefix.labels;
  console.log(`${prefixId} (${prefix.name || ""})`);
  console.log(`  최신 version: ${latestVer}`);
  console.log(`  addressModel: ${prefix.addressModel ?? "product"}`);
  console.log(`  labels: [${labels.join(", ")}]`);
  console.log(`  dims: ${labels.length}개`);

  // sum 모델: 세그먼트 정보
  if (prefix.addressModel === "sum") {
    const vdef = prefix.versions.find(v => v.version === latestVer);
    if (vdef?.segments) {
      console.log(`  segments: ${vdef.segments.length}개`);
      for (const seg of vdef.segments) {
        const trans = seg.transition ? ` → ${seg.transition.eventKey}` : "";
        const routes = seg.routes ? ` (${seg.routes.length} routes)` : "";
        console.log(`    ${seg.segmentId}: consumes:[${seg.consumes.join(",")}] size:${seg.size}${trans}${routes}`);
      }
    }
  }

  // dim별 axis entry 현황
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const dim = prefix.dims[label];
    if (dim.kind === "axis") {
      const axis = catalog.axes[dim.axisId];
      if (axis) {
        const axisVer = prefix.versions[prefix.versions.length - 1]?.axisVersions?.[label];
        const snap = axisVer ? axis.versions[axisVer] : undefined;
        const entryCount = snap?.entries?.length ?? "?";
        console.log(`  ${label}:${i} (${dim.axisId}) — ${entryCount} entries`);
      }
    } else if (dim.kind === "prefix_ref") {
      console.log(`  ${label}:${i} (→ ${dim.prefixId}) — prefix_ref`);
    }
  }

  // 사용처
  if (stamps.length === 0) {
    console.log(`\n사용처: 없음`);
    return;
  }

  console.log(`\n사용처 (${stamps.length}건):`);
  for (const s of stamps) {
    const dimsStr = s.stamp.dims.length > 0
      ? ` — dims: [${s.stamp.dims.map(d => `${d.label}:${d.index}`).join(", ")}]`
      : "";
    const versionTag = s.stamp.version !== latestVer ? ` ⚠ ${s.stamp.version}` : "";
    console.log(`  ${s.file}:${s.line}${versionTag}${dimsStr}`);
  }

  // version-behind 경고
  const behind = stamps.filter(s => s.stamp.version && s.stamp.version !== latestVer);
  if (behind.length > 0) {
    console.log(`\n⚠ ${behind.length}건이 최신 version(${latestVer})이 아님`);
  }
}

// ── 파일 수집 ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".next", ".turbo"]);
const SUPPORTED_EXTS = new Set(Object.keys(COMMENT_PREFIX));

function collectFiles(roots: string[]): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile() && SUPPORTED_EXTS.has(extname(full))) {
        results.push(full);
      }
    }
  }

  for (const root of roots) {
    const absRoot = resolve(root);
    if (!existsSync(absRoot)) continue;
    const st = statSync(absRoot);
    if (st.isDirectory()) walk(absRoot);
    else if (st.isFile()) results.push(absRoot);
  }

  return results;
}
