---
def:
  id: definition-service-sync
  type: design
  tier: system
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  lineage_facet: egress
  lineage_kind: settlement
  links:
    - target: definition-catalog-spec
      type: depends_on
  sources:
    - packages/definition-service/src/modules/sync/sync.service.ts
    - packages/definition-service/src/modules/sync/sync.controller.ts
    - packages/definition-service/src/modules/sync/sync.service.test.ts
    - packages/definition-service/src/sync/scanner.ts
    - packages/definition-service/src/core/sync-engine.ts
    - packages/definition-service/src/sync/reverse-sync.ts
    - packages/definition-service/src/sync/aspect-parents-sync.ts
    - packages/definition-service/src/sync/aspect-parents-sync.test.ts
    - packages/definition-data-source/src/sync-local-db.ts
    - packages/definition-data-source/src/sync-local-db.test.ts
    - packages/definition-data-source/src/factory.test.ts
    - packages/cli/src/commands/def.ts
---

# Definition Service Sync — 동기화 로직

## 목적 ^purpose

로컬 마크다운 문서의 메타데이터를 추출하여 데이터베이스로 동기화(Ingest)한다.

동기화 표면은 두 개다. 서비스 런타임은 `SyncService.run()`이 `syncDocsToDb()`를 호출하고, CLI local DB는 `qa-sdk def sync`가 `syncDocsToLocalDb()`를 호출한다.

## 의도 설명 ^intent

1. 마크다운의 `id` 필드는 `ingress` (유입) 된다.
2. `core` 단계에서 중복 및 유효성 검증을 거친다.
3. 최종적으로 DB의 `doc_id` 컬럼에 `egress` (안착) 된다.

## 처리 단계 ^overview

- `scanAndBuild()`로 frontmatter와 링크 그래프를 구성한다.
- `buildDocRecord()`가 body hash, marker, address, sourcePath를 DocRecord로 조립한다.
- 서비스 sync는 `DocStore.upsert()`로 created/updated/unchanged를 판정하고 삭제된 문서를 제거한다.
- local DB sync는 SQLite 테이블을 재생성한 뒤 documents, document_links, code_references, aspect_parents를 단일 트랜잭션으로 적재한다.
- sync 후 검색 인덱스와 semantic grounding materialization을 재구축한다.

## 검증 ^verification

- `definition-service-sync` 로직은 로컬 파일과 DB 간의 1:1 대응을 보장해야 함.
- 보조 로직(`auxiliary`)인 로깅은 비즈니스 흐름에 영향을 주지 않아야 함.
- `qa-sdk def sync`는 동기화된 문서 수, 링크 수, DB 경로를 출력한다.
- `qa-sdk def validate`는 DB/scan 결과의 그래프와 code reference를 검증한다.

## 관련 소스

- `packages/definition-service/src/modules/sync/sync.service.ts` — 서비스 sync orchestration
- `packages/definition-service/src/sync/scanner.ts` — docs scan → DocStore sync
- `packages/definition-service/src/core/sync-engine.ts` — hash/marker/DocRecord 조립
- `packages/definition-data-source/src/sync-local-db.ts` — CLI local SQLite sync
- `packages/cli/src/commands/def.ts` — `def sync`, `def validate` CLI surface
