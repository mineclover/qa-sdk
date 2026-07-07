---
def:
  tier: component
  id: compat-removal
  type: spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: meta-semantic-v2-migration
      type: traces_to
    - target: meta-semantic-scope
      type: traces_to
  sources:
    - packages/definition-catalog/src/taxonomy.ts
    - packages/definition-catalog/src/taxonomy.test.ts
    - packages/definition-catalog/src/scope-registry.ts
    - packages/definition-catalog/src/scope-registry.test.ts
    - packages/definition-catalog/src/index.ts
---

# compat 파일 제거 (ASPECT_TO_SCOPE 잔존 19줄)

## 목적 ^purpose

v2 마이그레이션 완료 후 잔존하는 `compat.ts`를 제거한다.
`ASPECT_TO_SCOPE` (1:1 역참조)는 N:M 모델(`ASPECT_TO_SCOPES`)로 대체 완료되었으나
일부 소비자가 아직 참조 중이다.

## 할 일

- [ ] `ASPECT_TO_SCOPE` import하는 파일 전수 조사 (grep)
- [ ] 각 소비자를 `ASPECT_TO_SCOPES` (N:M) 또는 `ScopeRegistry`로 전환
- [ ] 전환 완료 확인 (import 0건)
- [ ] `compat.ts` 파일 삭제
- [ ] 기존 테스트 전부 통과 확인

## 현재 상태

- `definition-catalog/src/compat.ts`: 19줄 (`ASPECT_TO_SCOPE` 1:1 역참조 맵)
- `ASPECT_TO_SCOPES` (N:M): `definition-catalog/src/taxonomy.ts`에 구현 완료
- `ScopeRegistry`: `definition-catalog/src/scope-registry.ts`에 구현 완료 (14 tests)

## 위험

- 외부 소비자(CLI, 서비스)가 `ASPECT_TO_SCOPE`를 직접 사용할 수 있음 → grep 필수
- 제거 후 타입 에러 발생 시 즉시 대체 코드 적용
