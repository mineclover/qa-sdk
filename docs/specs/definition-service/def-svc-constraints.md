---
def:
  id: def-svc-constraints
  tier: component
  address: def_document:v2:273548
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [structural, runtime, observability]
  links:
    - target: definition-service-system
      type: constrains
    - target: def-svc-docs-module
      type: constrains
sources:
  - packages/definition-service/src/core/axis-registry.ts
  - packages/definition-service/src/core/compute-address.ts
  - packages/definition-service/src/core/doc-versioner.ts
  - packages/definition-service/src/modules/docs/docs.controller.ts
  - packages/definition-service/src/modules/graph/graph.service.ts
  - packages/definition-service/src/sync/reverse-sync.ts
  - packages/definition-service/src/core/doc-versioner.test.ts
  - packages/definition-catalog/src/taxonomy.test.ts
  - packages/definition-service/package.json
  - packages/definition-service/scripts/dev.mjs
---
# Definition Service — 기술 제약

## 목적 ^purpose

definition-service의 동작을 제한하는 불변 조건과 검증 규칙을 정의한다.

## 구성 ^overview

### 좌표 제약

| 규칙 | 설명 | 위반 시 |
|------|------|---------|
| scope×aspect 유효 조합 | definition-catalog의 `VALID_SCOPE_ASPECTS` 조합만 허용 | PATCH 400 에러 |
| AxisRegistry 검증 | scope/aspect/depth/lifecycle 값이 registry-service 축 entries에 존재 | PATCH 400 에러 |
| address 자동 계산 | scope×aspect×depth 변경 시 자동 재계산 | 계산 실패 시 null (저장 차단 않음) |

### 동기화 제약

| 규칙 | 설명 |
|------|------|
| DB가 메타데이터 SSOT | frontmatter의 scope/aspect/depth/lifecycle/layer/tags/links/svc는 DB에서 파생 |
| 파일이 본문 SSOT | purpose/intent/context/caveat는 마크다운 파일에서 추출 |
| 병합 방식 역동기화 | DB→file 시 커스텀 필드(source: 등) 보존, DB 소유 필드만 교체 |
| version 단조 증가 | 모든 변경은 version +1, 감소 없음 |

### 그래프 제약

| 규칙 | 설명 | 검증 |
|------|------|------|
| 깨진 링크 금지 | target이 존재하지 않는 문서 참조 금지 | POST /graph/validate → error |
| 자기 참조 금지 | A → A 링크 금지 | POST /graph/validate → error |
| 순환 참조 금지 | depends_on/implements/refines에서 순환 금지 | POST /graph/validate → error |
| 고아 문서 경고 | approved인데 아무도 참조하지 않는 리프 | POST /graph/validate → warning |

### 네트워크 제약

| 규칙 | 설명 |
|------|------|
| registry-service 축 검증 fail-open | AxisRegistry fetch 실패 시 로컬 캐시(하드코딩) 사용 |
| 서버 시작 시 외부 fetch timeout | AbortSignal.timeout(5_000) 필수 |

### 개발 실행 제약 ^development-runtime

- `definition-service`의 `dev` 명령은 [`scripts/dev.mjs`](../../../packages/definition-service/scripts/dev.mjs)가 소유한다.
- GraphQL decorator metadata를 보존하기 위해 개발 컴파일러는 `tsc --watch`를 사용한다. `tsx watch src/main.ts`로 대체하면 `design:paramtypes`가 사라져 GraphQL schema 생성이 실패할 수 있다.
- 컴파일 시작 시 기존 앱을 중단하고 `Found 0 errors. Watching for file changes.` 이후에만 `dist/main.js`를 실행한다. 컴파일 중간 산출물을 읽는 `tsc --watch` + `node --watch` 병렬 조합은 허용하지 않는다.
- `build` 경로는 tsup decorator metadata 변환을 위해 `@swc/core`를 사용한다. workspace install policy에도 해당 build dependency가 허용되어야 한다.
- startup sync는 `SYNC_ON_START=true`인 definition-service가 소유한다. registry-service가 동시에 `DEFINITION_SYNC_ON_SEED=true`로 실행되는 구성은 로컬 프로파일에서 금지한다.

검증: `corepack pnpm --filter @qa-sdk/definition-service build`, `corepack pnpm --filter @qa-sdk/definition-service test`, `corepack pnpm health`.
