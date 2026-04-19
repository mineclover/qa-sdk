---
def:
  id: ontology-pack-validate
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: ontology-pack-validate
  tags: [contract, structural]
  links:
    - target: deterministic-label-architecture
      type: depends_on
    - target: docs-control-plane
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
  source: packages/ontology-pack-validate/src/index.ts
---

# ontology-pack-validate — 공개 계약

## 목적 ^purpose

`ontology-pack-validate` unscoped library의 **공개 API 계약**을 고정한다. Issue source 분류, readiness status enum, docs reader DI 정책, pack 해석 규칙을 명문화해 소비자(cli, deterministic-label-registry)의 기대를 맞춘다. 본 spec은 deterministic-label 아키텍처 계층 중 Layer 2(도구 통합)에 위치한다.

## 구성 ^overview

Entry point → result shape → issue 분류 → readiness status → DI 정책 → known pack registry.

## 1. Entry point

```typescript
validateOntologyPackFromRef(input: ValidateOntologyPackInput): Promise<OntologyPackValidateResult>
```

### Input

```typescript
interface ValidateOntologyPackInput {
  readonly packRef: string;              // pack id (known) OR file path
  readonly rootDir?: string;              // workspace root. 미지정 시 process.cwd() + findWorkspaceRoot
  readonly readDocsFamily?: OntologyPackDocsFamilyReader;  // DI, 아래 §5
}
```

### Output

```typescript
interface OntologyPackValidateResult {
  readonly valid: boolean;                // issues 중 error 0건이면 true
  readonly packRef: string;               // input packRef echo
  readonly packId: string | null;         // 로드 성공 시 pack의 packId, 실패 시 null
  readonly resolution: OntologyPackValidateResolution;  // known-pack / file-path / unresolved
  readonly issues: readonly OntologyPackValidateIssue[];
  readonly identity: OntologyPackValidateIdentitySummary;
  readonly componentSchema: OntologyPackValidateComponentSchemaSummary;
  readonly systemBindings: OntologyPackValidateSystemBindingSummary;
  readonly readiness: OntologyPackValidateReadiness;  // 4 카테고리
  readonly runtime: OntologyPackValidateRuntimeSummary;
}
```

## 2. Issue 체계 ^defines

### severity

```typescript
type OntologyPackValidateIssueLevel = "error" | "warning";
```

- `error` — pack 사용 불가 수준 (`valid: false`)
- `warning` — 완전하지 않으나 pack 자체는 유효 (`valid: true` 가능)

### source — 9 카테고리 (frozen v1)

| source | 의미 |
|--------|------|
| `resolver` | packRef를 known/file로 해석 시 문제 (unknown pack id, 경로 없음) |
| `loader` | JSON 파싱, 파일 읽기 실패, schema missing |
| `pack` | pack 메타데이터 자체의 규범 위반 (packId 누락 등) |
| `schema` | component schema (axes / taxonomies / relations / traversals) 구조 위반 |
| `blueprint` | system bindings 내 blueprint 위반 |
| `governance_taxonomy` | governance taxonomy 구조/참조 위반 |
| `file` | implementation/test 파일 존재 검증 결과 |
| `docs` | docs family 매칭 결과 |
| `source-map` | docs의 source 선언과 pack 파일 참조 일치 검증 |

9 source는 **frozen**. 신규 source 추가 = breaking change (v2 spec).

### code 규약

- 형식: `<source>-<description>` kebab-case (예: `source-map-missing`, `pack-missing-id`)
- 같은 source 내 code는 고유
- code 문자열은 **frozen** — 새 code는 additive OK, 기존 rename 금지

## 3. Readiness status enum

### 파일 readiness (implementation / test)

| status | 의미 |
|--------|------|
| `ready` | 선언된 파일 전부 존재 |
| `missing` | 선언된 파일 중 일부 or 전체 부재 |
| `skipped` | blueprint에 파일 ref 없어서 검증 불필요 |

### docs readiness

| status | 의미 |
|--------|------|
| `ready` | docs family 발견 + source-map ready |
| `partial` | docs family 일부 또는 source-map partial |
| `missing` | docs family 부재 |
| `skipped` | `readDocsFamily` 미주입 (§5 참조) |

### source-map readiness

| status | 의미 |
|--------|------|
| `ready` | 모든 checkedRefs가 docs 내 source로 커버됨 |
| `partial` | 일부 커버 |
| `missing` | 커버 0 |
| `skipped` | 검사할 ref 없음 (implementation file 0개) |

status enum은 **frozen**.

## 4. Resolution 규칙

```typescript
type OntologyPackValidateResolution = {
  kind: "known-pack" | "file-path" | "unresolved";
  packRef: string;
  knownPackId?: KnownOntologyPackId;
  filePath?: string;
  supportedFilePath?: string;
};
```

- packRef가 `KNOWN_ONTOLOGY_PACK_IDS`에 있음 → `kind: "known-pack"`
- packRef가 `.json`/`.js` 파일 경로 (절대 or rootDir 기준 상대) → `kind: "file-path"`
- 둘 다 아님 → `kind: "unresolved"` + `resolver` source의 error issue

## 5. Docs family reader DI 정책

### 주입 지점

```typescript
type OntologyPackDocsFamilyReader = (input: {
  readonly packId: string;
  readonly rootDir: string;
}) => Promise<readonly DocumentEnvelope[]>;
```

### 미주입 시 동작

- `docs` readiness status = `"skipped"` (silent skip)
- **`docs-reader-not-injected` warning issue 발행** (2026-04-18 개선)
  - source: `docs`
  - level: `warning`
  - code: `docs-reader-not-injected`
  - message: `Docs readiness skipped: no readDocsFamily reader injected`

소비자는 warning을 보고 "docs 검증을 의도적으로 생략"인지 "실수로 누락"인지 판단 가능.

### 주입된 경우

- reader가 반환하는 envelope 리스트를 `filterMatchingDocsForPack(packId, docs)`로 필터링 후 사용
- reader 자체는 환경 특화 (cli의 definition-markdown adapter 등)

## 6. Known pack registry

- `KNOWN_ONTOLOGY_PACK_IDS`: `readonly string[]` — 패키지에 직접 등록된 pack id
- `KnownOntologyPackId`: union of registered ids
- 현재 등록: `"programming-artifact-ontology"`, `"authorization-ontology"`
- 새 pack 등록 = `known-ontology-packs.ts` 수정 + 해당 pack 패키지 의존 추가

### 확장성 보류

Pack이 3개 이상으로 늘어나면 "pack이 자체 등록을 선언하는" 분산 registry로 전환 검토. 현재 2개 수준에서는 중앙집중 수용 가능.

## 7. rootDir 및 환경 의존

- `input.rootDir`이 주어지면 그 경로를 절대 경로로 확정 후 `findWorkspaceRoot()`로 workspace root 찾음
- 미지정 시 `process.cwd()` 사용 — **비결정성 소스**. 본 패키지를 테스트/스크립트에서 쓸 때 **항상 `rootDir` 명시 권장**
- `validateOntologyPackFromRef` 자체는 다른 environment read 없음 (env vars, timers, random 없음)

## 규칙

### R-1. Issue source / code frozen
9 source는 v1에서 변경 불가. 새 source 추가 = v2 breaking. 새 code는 기존 source 아래에 additive OK.

### R-2. Readiness status 값 frozen
`ready` / `partial` / `missing` / `skipped` 4개. 새 값 추가 = breaking.

### R-3. DI 의존 금지 (package 소유가 아닌 것)
`ontology-pack-validate`는 특정 adapter(definition-markdown 등)를 직접 import 금지. 필요 시 옵션 타입으로 주입점만 선언.

### R-4. rootDir 명시 의무 (외부 호출자)
테스트, 스크립트, deterministic 문맥에서는 `rootDir` 명시 필수. `process.cwd()` fallback은 operator가 shell에서 직접 호출할 때의 편의.

## 구현 참조

- 구현: `packages/ontology-pack-validate/src/index.ts` (entry) + `src/internal/*.ts`
- 테스트: `packages/ontology-pack-validate/src/internal/*.test.ts` (9 tests)
- 경계 강제: `packages/cli/src/lib/deterministic-label-boundary.test.ts` (Layer 2)

## 비목표

- 본 spec은 **pack 자체의 schema**를 정의하지 않음 — `operational-ontology`의 pack 타입이 담당
- 본 spec은 **pack authoring** (scaffold, write) 경로를 다루지 않음 — cli의 `ontology pack scaffold` 영역
- 본 spec은 **runtime activation** (등록, index-meta 기록)을 다루지 않음 — `registry-service` 영역
