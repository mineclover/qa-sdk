---
def:
  id: deterministic-label-coordinate-stability
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
  svc: cli
  tags: [contract, structural, versioning]
  links:
    - target: deterministic-label-stability-plan
      type: refines
    - target: deterministic-label-stability-boundary
      type: traces_to
    - target: deterministic-label-registry-extraction-plan
      type: depends_on
    - target: docs-control-plane
      type: depends_on
sources:
  - packages/deterministic-label-registry/src/coordinate.ts
  - packages/deterministic-label-registry/src/projection.ts
  - packages/deterministic-label-registry/src/collision.ts
  - packages/deterministic-label-registry/src/shared.ts
  - packages/cli/src/lib/deterministic-label-registry.test.ts
---

# Deterministic Label — 좌표 안정성 계약

## 목적 ^purpose

`deterministic-label-registry`가 생성하는 semantic coordinate(URN)의 **v1 format을 고정**한다. 같은 source state → 같은 URN이라는 content-derived identity 계약(1A)을 spec으로 명문화해, 이후 PRD가 잠금해야 할 대상과 변경 시 breaking 여부를 판별할 기준을 제공한다.

## 구성 ^overview

8 label kind × URN 형식 × subtype 추론 × version 계약 × collision 해결 규칙 + 진화(additive/breaking) 분류.

## 1. URN 형식

### 일반 형식

```
urn:<domain>:<subtype>:<id>:<version>
```

### `prd-story` 예외

```
urn:<domain>:<subtype>:<parentId>:<id>
```

`prd-story`는 parent PRD에 속하므로 `parentId`를 중간에 둬 계층을 표현한다. version은 parent에 포함되므로 story 자체에는 부여하지 않는다.

### 빈 part는 compact 제거

```
compactParts([domain, subtype, id, version]) → 빈 문자열/undefined 요소 제거
```

version 생략 시 `urn:<domain>:<subtype>:<id>` 형식이 유효 (예: `source-file`은 version 없음).

## 2. 8 label kind × domain × subtype 매핑

| kind | domain | 기본 subtype | 예시 URN |
|------|--------|-----------|---------|
| `definition-doc` | `def` | `spec` | `urn:def:spec:docs-control-plane:v1` |
| `source-file` | `source` | `file` | `urn:source:typescript:packages/cli/src/commands/docs.ts` |
| `ontology-pack` | `pack` | `ontology` | `urn:pack:ontology:programming-artifact-ontology:v1` |
| `artifact` | `artifact` | `artifact` | `urn:artifact:activation-evidence:programming-artifact-ontology:v1` |
| `prd-markdown` | `prd` | `markdown` | `urn:prd:markdown:tasks/prd-deterministic-label-registry-fsm-read-model:v1` |
| `ralph-prd-json` | `prd` | `ralph-json` | `urn:prd:ralph-json:tasks/prd-deterministic-label-registry-fsm-read-model:v1` |
| `prd-story` | `prd` | `story` | `urn:prd:story:tasks/prd-deterministic-label-registry-fsm-read-model:US-001` |
| `evidence` | `artifact` | `evidence` | `urn:artifact:evidence:checkout-proof:v1` |

kind/domain 매핑은 `packages/deterministic-label-registry/src/coordinate.ts`의 `DOMAIN_BY_KIND`에서 **frozen**이다. 신규 매핑은 v2에서만 허용.

## 3. subtype 추론 규칙

### `source-file` 전용 — 12 확장자 매핑

| 확장자 | subtype |
|--------|---------|
| `.tsx` | `typescript-react` |
| `.ts` | `typescript` |
| `.jsx` | `javascript-react` |
| `.js`, `.mjs`, `.cjs` | `javascript` |
| `.md`, `.mdx` | `markdown` |
| `.json` | `json` |
| `.yaml`, `.yml` | `yaml` |
| `.css` | `css` |
| `.html` | `html` |
| (그 외) | `file` |

`sourceSubtype(path)` 함수가 유일한 결정론 소스. 추가 확장자 → v2 추가 또는 v1에 additive(기본 `file` fallback 유지).

### 다른 kind — 명시적 override 또는 기본값

caller가 `input.subtype`을 주면 그 값 사용. 미제공 시 `DEFAULT_SUBTYPE_BY_KIND`의 기본값. 기본값 맵은 frozen.

## 4. Version 계약

### 입력

`input.version?: string | null` — 미지정 시 version 없이 URN 생성 (`compactParts` 제거).

### 검증

`versionPattern = /^v[1-9][0-9]*$/` — `v1`, `v2`, ..., `v99` 허용. `v0`, `v1.0`, `1.0.0`, `latest` 등 거부 → `semantic-coordinate-invalid-version` diagnostic.

### 기본값

문서 envelope에서 `metadata.version`을 우선 읽고, 없으면 `"v1"` 기본 적용 (`documentVersion()` 함수).

### v1 frozen 의미

본 spec이 선언하는 URN 형식 전체가 "v1"이다. 같은 URN 문자열을 생성하는 규칙은 v1 동안 불변. 규칙 변경 → v2 URN (새 포맷) + v1과 병존.

## 5. Collision 해결 규칙

### collision 정의

여러 candidate가 **같은 URN label을 산출**하는데 **physical ref 또는 kind가 서로 다른** 경우. 단 일부 kind/subtype 조합은 **의도된 multi-source**로 분류되어 별도 diagnostic code로 분리된다 (아래 "multi-source 예외" 참조).

### 판별 signature

```
candidateCollisionSignature(candidate) =
  `${kind}\u001f${id}\u001f${parentId ?? ""}\u001f${sortedPhysicalRefs}`
```

signature 기준으로 중복 제거 후 여전히 2개 이상이면 collision.

### diagnostic

`semantic-coordinate-collision-candidate` (warning) — 같은 URN을 복수의 physical ref가 생성하는 상태. error가 아닌 warning인 이유: records 숫자 자체에 의미를 부여하지 않으며, 다중 생성은 family/prd-story 같은 정상 multi-source가 대부분이라 operator 검토 대상으로 warning이 적합.

만약 record 1:1 per URN 보장이 요구되는 소비자가 등장하면 (`docs label inventory` 같은 operator 명령 등), diagnostic 분류 또는 candidate 생성 시점 dedupe이 별도 PRD로 재평가됨 (stability-boundary memo 참조).

### 자동 해결 없음

collision 발생 시 **경고만 하고 candidate를 그대로 유지**. 어느 쪽을 preferred로 쓸지는 상위 소비자(records/inventory)의 책임.

### preferred 우선순위 (label → 단일 candidate 선택 시)

```
1. metadata.idSource === "def.id"
2. metadata.idSource === "artifactId"
3. metadata.idSource === "packId"
4. metadata.idSource === "sourcePath"
5. metadata.idSource === "stableId"
6. 그 외 첫 번째
```

이 순서는 frozen이며, v2에서만 변경 가능.

## 6. 정규화 규칙

### path

```
normalizeCoordinatePart(value) = value.trim().replaceAll("\\", "/").replace(/\/+/g, "/")
```

Windows 경로 구분자를 `/`로 통일하고 중복 `/`를 제거한다. locale 독립.

### physical refs

`normalizePhysicalRefs`는 빈 ref 제거 + role/metadata 정규화. 순서는 입력 순서 보존.

### diagnostics

`normalizeRecordRefs` — 중복 제거 + `localeCompare` 정렬.

> 주의: `localeCompare`는 JS 기본 locale 의존. Stability 계약상 locale-free 정렬이 필요하면 별도 비교자로 교체 (projection determinism spec에서 다룸).

## 7. 불변 공개 API (v1)

다음은 `packages/deterministic-label-registry/src/coordinate.ts`를 중심으로 **frozen**:

- `SEMANTIC_COORDINATE_LABEL_KINDS` — 8 kind 리스트
- `SEMANTIC_COORDINATE_DOMAINS` — 5 domain 리스트
- `SEMANTIC_PHYSICAL_REF_KINDS` — 8 physical ref kind 리스트
- `SEMANTIC_COORDINATE_DIAGNOSTIC_CODES` — 10 diagnostic code 리스트
- `SEMANTIC_EXISTING_ID_SOURCES` — 9 idSource enum
- `DOMAIN_BY_KIND` — kind → domain 매핑
- `DEFAULT_SUBTYPE_BY_KIND` — kind → 기본 subtype 매핑
- `SEMANTIC_COORDINATE_CANONICAL_EXAMPLES` — canonical URN 예시 집합
- `versionPattern` 정규식
- URN 조립 규칙 (`buildSemanticCoordinate`)
- `sourceSubtype` — source-file subtype 추론 (`projection.ts`)
- `candidateCollisionSignature` — label collision signature (`collision.ts`)
- `normalizeCoordinatePart` — locale-free path separator normalization (`shared.ts`)

## 8. 진화 분류

### Additive (v1 유지)

- 새 확장자를 `sourceSubtype`에 추가 (기존 fallback `"file"` 동일 → 충돌 없음)
- 새 diagnostic code 추가
- 새 physical ref role 추가
- 새 metadata 필드 추가
- 외부 소비자가 알 수 없던 internal helper 시그니처 변경

### Breaking (v2 필요)

- label kind 추가/제거 — URN 해석 변경
- domain 매핑 변경
- 기본 subtype 변경 — 기존 URN이 다르게 생성됨
- URN 조립 순서 변경 (일반 vs prd-story)
- version pattern 변경
- preferred candidate 우선순위 변경 — 같은 label이 다른 source를 가리키게 됨
- collision signature 규칙 변경

### Frozen — 변경 금지

- 현재 `SEMANTIC_COORDINATE_CANONICAL_EXAMPLES`의 각 예시 URN은 v1 동안 그대로 유효해야 함 (regression lock)

## 9. 규칙

### R-1. URN 규격 변경 절차

1. 변경이 additive인지 breaking인지 §8 기준으로 판정
2. additive: 본 spec에 새 엔트리 추가 + canonical examples 확장
3. breaking: v2 URN 도입 PRD 신설, v1 URN은 같은 repo에서 병존 기간 유지

### R-2. 새 kind 추가

- v1에 새 kind 추가 = breaking (URN kind enum 확장은 소비자 해석 변경)
- 따라서 **v1 kind 8종 frozen**, 9번째 kind → v2

### R-3. Collision 대응

- 새로 collision이 발생하면 **자동 해결 금지** — diagnostic만 발행
- 소비자(예: 라벨 인벤토리)가 preferred 규칙으로 선택 + diagnostic을 함께 노출

### R-4. Version 부재 허용

- version 없는 URN은 v1 정식이며 표기 생략이 **유효한 상태 표현**
- 소비자는 `parts.length`를 기준으로 version 존재 여부를 파악할 수 있으나 직접 인덱스 접근 금지 — `coordinate.parts`의 의미는 kind별로 다름

## 구현 참조

- 좌표/URN 구현: `packages/deterministic-label-registry/src/coordinate.ts`
- 문서 투영 subtype/version 구현: `packages/deterministic-label-registry/src/projection.ts`
- collision signature 구현: `packages/deterministic-label-registry/src/collision.ts`
- 공통 정규화 구현: `packages/deterministic-label-registry/src/shared.ts`
- 회귀 검증: `packages/cli/src/lib/deterministic-label-registry.test.ts`
  - `buildSemanticCoordinateCandidate()`
  - `buildSemanticCoordinate()`
  - `normalizeKind()`, `normalizeVersion()`, `normalizePhysicalRefs()`
  - `candidateCollisionSignature()`, `detectSemanticCoordinateCandidateCollisions()`
- 테스트: `packages/cli/src/lib/deterministic-label-registry.test.ts`
  - canonical URN 예시 잠금
  - 8 kind × 경로/ID edge case
  - Collision 감지 + preferred 선택

## 비목표

- **투영 결정론** — 정렬, 스냅샷, non-determinism 거부는 `deterministic-label-projection-determinism.spec.md`
- **FSM readiness / transition** — 초기 계획에는 있었으나 2026-04-18 단순화에서 제거됨. 재도입은 `state-event-terminology` 기준의 별도 설계 필요
- **append-only registry persistence** — deferred, write-mode PRD에서 다룸
- **URN rename 시 alias/redirection** — `def.id` 변경 = URN 변경이라는 1A 선택의 의도된 트레이드오프. 외부 링크 안정성은 별도 decision 필요 (본 spec 범위 밖)
