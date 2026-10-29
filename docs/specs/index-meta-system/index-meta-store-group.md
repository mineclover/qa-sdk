---
def:
  id: index-meta-store-group
  tier: layout
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
      type: refs
    - target: index-meta-store-resolution
      type: refs
    - target: index-meta-system
      type: depends_on
sources:
  - docs/specs/index-meta-system/index-meta-store-group/index-meta-store-contract.spec.md
  - docs/specs/index-meta-system/index-meta-store-group/index-meta-store-resolution.spec.md
  - docs/specs/index-meta-system/index-meta-store-group.cases.md
  - packages/index-meta/src/index-meta-store.ts
  - packages/index-meta/src/adapters/memory-store.ts
  - packages/index-meta-store/src/adapters/sql-store.ts
  - packages/index-meta-store/src/adapters/d1-store.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta/src/prefix-router.ts
  - packages/index-meta/src/cross-version-entry-sync.ts
---

# Index Meta Store 그룹

## 목적 ^purpose

index-meta 저장소 문서를 저장 계약과 주소 해석/재사용 경로로 분리해 persistence 책임과 resolution 책임을 각각 설명한다.

## 구성 ^overview

총 2개 멤버.
- `index-meta-store-contract`: 설계 목적, 역할 분리, 저장 타입, IndexMetaStore/SqlDriver/SqlDialect 인터페이스, 동작 규칙, SQL 어댑터 구현체 목록을 정리한 문서.
- `index-meta-store-resolution`: VersionLifecycleStore, MigrationStore, PrefixRouter, CrossVersionEntrySync, 주소 해석, decode 없는 재사용 전략을 정리한 문서.

## 현재 판정

이 그룹은 persistence port와 resolution/reuse runtime을 섞지 않기 위한 layout 문서다.

| 책임 | 소유 문서 | source-backed 표면 |
|------|-----------|--------------------|
| 저장 port와 SQL driver 계약 | `index-meta-store-contract` | `index-meta-store.ts`, `adapters/sql-store.ts`, `adapters/d1-store.ts` |
| 개발/테스트용 in-memory 구현 | `index-meta-store-resolution` | `adapters/memory-store.ts`, `adapters/memory-store.test.ts` |
| 버전 lifecycle과 migration history | `index-meta-store-resolution` | `version-lifecycle.ts`, `migration-store.ts` |
| prefix routing과 cross-version sync | `index-meta-store-resolution` | `prefix-router.ts`, `cross-version-entry-sync.ts` |

`PrefixRouter`는 prefix → D1 database 라우팅만 소유한다. version codec 선택과 serialized address 복원은 PrefixRegistry/address protocol 쪽 책임이다.

원본: `docs/specs/indexing/index-meta/store.spec.md` (`index-meta-store`)
