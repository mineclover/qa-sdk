---
def:
  id: def-svc-sync-module
  tier: component
  address: def_document:v2:137472
  scope: flow
  aspect: process_flow
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, observability, structural]
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-data-model
      type: depends_on
source: packages/definition-service/src/sync/reverse-sync.ts
---
# Definition Service — Sync Module

## 목적 ^purpose

마크다운 파일과 DB 간 양방향 동기화를 관리하는 모듈. 파일→DB (본문/마커 수집)와 DB→파일 (메타데이터 frontmatter 기록) 두 방향을 제공한다.

## 구성 ^overview

### 동기화 흐름

```
POST /sync (file → DB)
  1. scanAndBuild() — 마크다운 파일에서 id, frontmatter, body 추출
  2. buildDocRecord() — address 계산, markers 추출, body_hash
  3. docStore.upsert() — 변경 감지 (created/updated/unchanged)
  4. syncLinks() — document_links edge 테이블 동기화
  5. syncFts() — FTS5 인덱스 갱신

POST /sync/to-files (DB → file)
  1. docStore.list() — 전체 문서 조회
  2. writeFrontmatterToFile() — 병합 방식 (DB 소유 필드만 교체)
     - 보존: id, address, 커스텀 필드 (source: 등)
     - 교체: scope, aspect, depth, lifecycle, layer, tags, links, svc
```

### SeedService 연동

- `onModuleInit()` — SYNC_ON_START=true 시 자동 동기화
- sync 후 definition-service.triggerSync() 호출 (fail-open)
