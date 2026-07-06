---
def:
  id: registry-quality-bundle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, quality-gate, registry]
  links:
    - target: registry-quality-bundle
      type: refines
    - target: registry-system
      type: depends_on
sources:
  - packages/registry-service/src/app.module.ts
  - packages/registry-service/src/lib/registry-service.ts
  - packages/registry-service/src/modules/services/service-topology.service.ts
  - packages/registry-service/src/modules/manifests/manifest.service.ts
  - packages/registry-service/src/modules/resolve/resolve.service.ts
  - packages/registry-service/src/app.test.ts
---

# Registry Quality Bundle — 소비자 기대 시나리오

## 목적 ^purpose

`registry-quality-bundle`(build/test/service-flow 게이트 + registry-quality-contract)이 `registry-system`에 의존할 때 기대하는 계약. 품질 번들은 registry-system 이 제공하는 prefix/version/service topology surface 와 안정적 API 계약 위에서만 claim audit 기준점으로 기능한다.

## 시나리오 1: registry-quality-contract surface 고정 ^overview

**전제**: `registry-system`이 prefix registry, version lifecycle, service topology 를 공식 surface 로 선언.

**동작**: quality-bundle 이 `gate-registry-test` 를 통해 API 호환성 테스트 수행.

**기대**:
- 현재 registry-system 문서가 명시한 엔드포인트가 모두 존재 (누락 없음)
- 각 엔드포인트의 request/response 스키마가 문서 계약과 일치 (JSON Schema 검증)
- 추가 엔드포인트가 있으면 warning(미문서화) + 문서 업데이트 유도

**실패 시 수정 대상**: `registry-system.md` §"구성" — surface 가 spec 이 아닌 구현 중심이면 quality-bundle 의 claim 기준이 구현 따라 흔들림. spec 이 SSOT 여야 함.

## 시나리오 2: gate-registry-build 배포 가능성 검증 ^overview

**전제**: `registry-system`이 npm 패키지 `@qa-sdk/registry-service` 로 배포되며 ESM only 빌드 규약 준수.

**동작**: quality-bundle 의 build 게이트가 tsc + publish dry-run 을 실행.

**기대**:
- TypeScript target: ES2023 (CLAUDE.md 규약)
- dist/ 에 ESM entrypoint 만 존재 (CJS 금지 — @qa-sdk/* scope 는 ESM only)
- package.json `exports` 필드가 실제 dist 파일과 일치

**실패 시 수정 대상**: `registry-system.md` 또는 관련 빌드 문서 — 배포 규약(ESM only, ES2023)이 다른 spec 과 drift 되면 registry service 소비자가 CJS import 를 시도하여 실패.

## 시나리오 3: service topology 등록/조회 flow ^overview

**전제**: `registry-system`의 `registry-services-api-spec`이 서비스 메타데이터 CRUD 를 제공.

**동작**: `gate-registry-service-flow` 게이트가 신규 서비스 등록 → 조회 → 업데이트 시나리오 실행.

**기대**:
- 등록 직후 조회 시 원본 필드 불변 (contentHash 기반 결정론적)
- 업데이트 시 `version` 필드 증가, 이전 버전은 history 로 보존
- 삭제는 tombstone 으로 소프트 삭제 (hard delete 금지)

**실패 시 수정 대상**: `registry-system.md` §"registry-services-api-spec" — 업데이트/삭제 시 history 정책이 비어 있으면 quality-bundle 은 snapshot 비교만 가능하여 lifecycle 드리프트를 감지 못함.

## 시나리오 4: prefix DAG 변경 전파 검증 ^overview

**전제**: `registry-system`이 PrefixRecord + VersionRecord + DimRef 3개 엔티티로 DAG 관계 질의 를 제공.

**동작**: prefix A 가 prefix B 를 ref 하는 DAG 에서 B 의 capacity 가 변경되면 A 의 상태 재계산.

**기대**:
- A 의 versionId 가 자동 bump 또는 pending 상태로 전이
- CON-006 (prefix_ref refEntries 필수) 위반 시 GateEngine reserved 처리
- 변경 전파 테스트가 quality-bundle `gate-registry-test` 에서 실행

**실패 시 수정 대상**: `registry-system.md` §"registry-data-model" — DimRef 변경 전파 규칙이 빠져 있으면 soft capacity change 가 silent breakage 로 전파.
