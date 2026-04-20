---
def:
  id: index-meta-store-group
  level: module
  tier: system
  address: def_document:v2:342025
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [structural]
  links:
    - target: index-meta-store-contract
      type: contains
    - target: index-meta-store-resolution
      type: contains
---

# Index Meta Store 그룹

## 목적 ^purpose

index-meta 저장소 문서를 저장 계약과 주소 해석/재사용 경로로 분리해 persistence 책임과 resolution 책임을 각각 설명한다.

## 구성 ^overview

총 2개 멤버.
- `index-meta-store-contract`: 설계 목적, 역할 분리, 저장 타입, IndexMetaStore/SqlDriver/SqlDialect 인터페이스, 동작 규칙, SQL 어댑터 구현체 목록을 정리한 문서.
- `index-meta-store-resolution`: VersionLifecycleStore, MigrationStore, PrefixRouter, CrossVersionEntrySync, 주소 해석, decode 없는 재사용 전략을 정리한 문서.

원본: `docs/specs/indexing/index-meta/store.spec.md` (`index-meta-store`)
