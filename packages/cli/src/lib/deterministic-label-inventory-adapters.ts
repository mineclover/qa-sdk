// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DocumentAdapter } from "doc-envelope";

import {
  createArtifactEvidenceAdapter,
  type ArtifactEvidenceAdapterOptions,
} from "./docs-control-plane/adapters/artifact-evidence.js";
import {
  createDefinitionMarkdownAdapter,
  type DefinitionMarkdownAdapterOptions,
} from "./docs-control-plane/adapters/definition-markdown.js";
import {
  createPrdMarkdownAdapter,
  type PrdMarkdownAdapterOptions,
} from "./docs-control-plane/adapters/prd-markdown.js";
import {
  createRalphPrdJsonAdapter,
  createRalphSessionAdapter,
  type RalphPrdJsonAdapterOptions,
  type RalphSessionAdapterOptions,
} from "ralph-tui-integration";

export interface DeterministicLabelInventoryAdapterOptions {
  readonly rootDir: string;
  readonly docsDirs?: readonly string[] | null;
  readonly prdDirs?: readonly string[] | null;
  readonly artifactRegistryPaths?: readonly string[] | null;
  readonly sessionPath?: string | null;
  readonly prdJsonPath?: string | null;
  readonly prdPath?: string | null;
}

/**
 * 환경 조립 (Layer 5) — 5종 adapter를 cli 기준으로 factory 조립해
 * `deterministic-label-registry`의 `buildDeterministicLabelInventory`에 주입한다.
 *
 * 소유권 맵 (SSOT: `docs/specs/definition-catalog/deterministic-label-architecture.spec.md`)
 *
 * | Adapter              | 소유 패키지                | 근거 |
 * | -------------------- | ------------------------- | ---- |
 * | definition-markdown  | cli (본 디렉토리)          | definition-catalog의 frontmatter scanner/graph validation을 재사용 — cli 고유 |
 * | prd-markdown         | cli (본 디렉토리)          | `[PRD]...[/PRD]` block 파서는 cli가 소유 |
 * | artifact-evidence    | cli (본 디렉토리)          | 로컬 artifact registry JSON reader는 cli가 소유 |
 * | ralph-prd-json       | ralph-tui-integration      | flat-root PRD JSON 포맷은 ralph-tui 특화 — 외부 도구 지식 격리 |
 * | ralph-session        | ralph-tui-integration      | `.ralph-tui/session-meta.json` 경로 + drift 감지는 ralph-tui 특화 |
 *
 * 경계 근거:
 *   - `deterministic-label-registry`는 adapter 종류/도구를 알지 못한다
 *     (Layer 3, interpretation). 소비자(cli)가 adapter 주입으로 결정.
 *   - `ralph-tui-integration`은 `doc-envelope`만 의존한다 (Layer 2). cli가
 *     두 소스(cli 소유 3종 + ralph-tui 2종)를 합성해 단일 adapter list로 제공.
 *   - 역방향 import 금지 (R-1): `ralph-tui-integration`이 cli를 import 하지 않고,
 *     cli가 registry를 alias 하지 않는다.
 *   - Layer 2 횡단 금지 (R-2): cli는 ralph-tui 2종과 cli 소유 3종을 조합하지만,
 *     `ontology-pack-validate`(Layer 2의 다른 축)와 `ralph-tui-integration`은
 *     서로를 알지 못한다.
 *
 * 기계적 강제: `deterministic-label-boundary.test.ts`가 각 패키지의
 * `package.json` dependencies를 스캔해 위반 시 실패시킨다.
 */
export function createDeterministicLabelInventoryAdapters(
  options: DeterministicLabelInventoryAdapterOptions,
): readonly DocumentAdapter[] {
  const definitionOptions: DefinitionMarkdownAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.docsDirs ? { docsDirs: options.docsDirs } : {}),
  };
  const prdMarkdownOptions: PrdMarkdownAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.prdDirs ? { dirs: options.prdDirs } : {}),
  };
  const ralphPrdOptions: RalphPrdJsonAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.prdDirs ? { dirs: options.prdDirs } : {}),
  };
  const prdJsonPath = resolvePrdJsonPath(options);
  const sessionOptions: RalphSessionAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.sessionPath ? { path: options.sessionPath } : {}),
    ...(prdJsonPath ? { prdJsonPath } : {}),
  };
  const artifactOptions: ArtifactEvidenceAdapterOptions = {
    rootDir: options.rootDir,
    ...(options.artifactRegistryPaths
      ? { registryPaths: options.artifactRegistryPaths }
      : {}),
  };

  return [
    createDefinitionMarkdownAdapter(definitionOptions),
    createPrdMarkdownAdapter(prdMarkdownOptions),
    createRalphPrdJsonAdapter(ralphPrdOptions),
    createRalphSessionAdapter(sessionOptions),
    createArtifactEvidenceAdapter(artifactOptions),
  ];
}

function resolvePrdJsonPath(
  options: DeterministicLabelInventoryAdapterOptions,
): string | undefined {
  return options.prdJsonPath
    ?? (options.prdPath?.endsWith(".json") ? options.prdPath : undefined)
    ?? undefined;
}
