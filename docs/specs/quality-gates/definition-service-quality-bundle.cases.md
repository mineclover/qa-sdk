---
def:
  id: definition-service-quality-bundle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, quality-gate, definition-service]
  links:
    - target: definition-service-quality-bundle
      type: refines
    - target: definition-service-system
      type: depends_on
---

# Definition Service Quality Bundle — 소비자 기대 시나리오

## 목적 ^purpose

`definition-service-quality-bundle`(build/sync/context 게이트 + definition-service-quality-contract)이 `definition-service-system`에 의존할 때 기대하는 계약. 번들은 definition-service 가 공개하는 docs/graph/sync/search/GraphQL surface 가 안정적일 때만 claim audit 의 기준점이 된다.

## 시나리오 1: file → DB 동기화 결정론 ^overview

**전제**: `definition-service-system`이 POST `/sync` 로 file → DB 단방향 동기화를 제공, DB 가 메타데이터 SSOT.

**동작**: `gate-definition-service-sync` 게이트가 같은 파일셋에 대해 sync 2회 연속 실행.

**기대**:
- 두 실행 결과 DB snapshot 동일 (idempotent)
- 파일 frontmatter 변경 시만 document_history 에 diff 기록
- sync 실패 → rollback, partial write 없음

**실패 시 수정 대상**: `definition-service-system.md` §"양방향 동기화" — sync idempotency 규칙이 명시되지 않으면 반복 실행 시 history 가 불필요한 entry 로 부풀어 오름.

## 시나리오 2: DB → file reverse sync 안전성 ^overview

**전제**: `definition-service-system`이 POST `/sync/to-files` 로 DB → file 역동기화를 제공.

**동작**: reverse sync 가 로컬 파일의 uncommitted 변경사항과 충돌.

**기대**:
- 기본 동작: 충돌 감지 → reject + 충돌 파일 리스트 응답
- `force=true` 옵션 → 파일 덮어쓰기 + backup 생성
- frontmatter 수정 시 DB도 수동 동기화 필수 (feedback 규약, force 가 자동 해결 금지)

**실패 시 수정 대상**: `definition-service-system.md` — reverse sync 충돌 정책이 자동 덮어쓰기로 기본 설정되면 uncommitted 작업을 잃을 위험. spec 에 "수동 동기화 필수" 명문화 필요.

## 시나리오 3: 빌드 + GraphQL 스키마 일관성 ^overview

**전제**: `definition-service-system`이 NestJS + Fastify + Mercurius(GraphQL) + SQLite, 포트 3700 으로 규정.

**동작**: `gate-definition-service-build` 가 tsc + GraphQL schema 생성 + introspection 실행.

**기대**:
- 빌드 후 `schema.gql` 파일 존재, DB entity 와 타입 일치
- 8개 모듈(docs/graph/sync/graphql/prefixes/intents/consumption/tests) 모두 GraphQL 에 노출
- REST 쓰기 + GraphQL 읽기 하이브리드 계약 준수

**실패 시 수정 대상**: `definition-service-system.md` §"구성" — 8개 모듈 중 하나라도 schema 에서 누락되면 bundle 의 context 게이트가 부분 응답만 검증.

## 시나리오 4: context 조회 경로 성능 + 정합성 ^overview

**전제**: `definition-service-system`이 FTS5 기반 full-text search + document_links 기반 그래프 탐색을 제공.

**동작**: `gate-definition-service-context` 가 `/context/:id` 로 상위/하위/제약/의존 정보 수집.

**기대**:
- 응답 필드: parents, children, dependencies, constraints, depth 레벨 포함
- 응답 시간 < 500ms (warm cache 가정)
- 링크 타입 unknown 포함 시 warning + 응답은 성공

**실패 시 수정 대상**: `definition-service-system.md` — context API 응답 스키마가 spec 에 고정되지 않으면 consumer(skill, CLI)가 각자 parse 로 recoverability 저하.
