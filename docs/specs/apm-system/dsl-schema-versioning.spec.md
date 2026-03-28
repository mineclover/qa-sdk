---
def:
  id: dsl-schema-versioning
  address: def_document:v2:273551
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [tier-system]
  links:
    - target: dsl-schemas-spec
      type: refines
---

# DSL 스키마 버전 정책

## 목적 ^purpose

DSL 스키마의 payload 배치, 축 재사용, snapshot 공급 방식, 버전 관리 정책을 정리해 codegen과 저장 계약이 흔들리지 않게 한다.

## 구성 ^overview

- `Snapshot 공급`: catalog에서 생성기와 런타임이 같은 축 정의를 보는 단일 공급원 규칙을 정의한다.
- `축 재사용 규칙`: 여러 DSL이 같은 의미 축을 공유할 때의 조건과 제한을 기술한다.
- `버전 전이 모델`: draft → locked → released → active → deprecated 라이프사이클을 명시한다.
- `entry 변경 영향 범위`: entry 추가/삭제 시 codegen/저장/주소공간에 미치는 영향을 정리한다.

## Snapshot 공급

Catalog(core/src/catalog/catalog.types.ts)가 유일한 스키마 입력(SSOT)이다. codegen, DKG, DecodeMap, BrowserCatalog는 모두 Catalog에서 파생된다.

```
DEMO_CATALOG (demo-snapshot)
  ├── codegen → demo-types (TS 타입 자동 생성)
  ├── bootstrapDkg → DKG graph
  ├── BROWSER_CATALOG → shop-web
  └── registry seed → D1 서비스/엔드포인트/이벤트스키마
```

- `latestPrefixVersion(catalog, prefixId)`로 동적 조회한다. `"v1"`, `"v2"` 하드코딩 금지.
- payload 배치는 운반 효율보다 재생성과 디버깅 가능성을 우선한다.
- 배포 시점의 entry snapshot ID는 `QaLoggerConfig.entrySnapshot`으로 envelope에 포함할 수 있다.

## 축 재사용 규칙

여러 prefix가 같은 VersionedAxis를 공유할 수 있다. 축 공유 조건:

1. **의미가 동일**해야 한다. 같은 이름이라도 도메인별 의미가 다르면 별도 축을 만든다.
2. **capacity 방향이 같아야** 한다. 한쪽에서 entry를 추가하면 공유하는 모든 prefix에 영향을 준다.
3. **임시 이름 복제는 금지**한다. action_v2 같은 이름 대신 축 자체를 분리하거나 version을 승격한다.

축 capacity 규칙: `nextPowerOf2(entries.length * 2)` 이상. headroom ≤ 1이면 warning, 0이면 critical.

## 버전 전이 모델

spec-core/src/propagation/lifecycle.ts가 버전 전이를 구현한다:

```
draft → locked → released (seal)
released → active + 이전 버전 deprecate (activateAndPropagate)
```

- **seal(registry, input)**: draft를 잠그고(locked) release 상태로 전환한다.
- **activateAndPropagate(registry, graph, input)**: released를 active로 전환하고, 이전 active 버전을 deprecate하며, DKG에 VersionEvent를 기록하고 알림을 생성한다.
- 버전은 snapshot 단위로 승격하며 도메인별 임의 버전을 따로 두지 않는다.
- `generateCatalogTypes()`는 timestamp 1회 캡처하여 같은 catalog이면 같은 contentHash를 보장한다(결정론성).

## entry 변경 영향 범위

| 변경 | codegen | 저장 | 주소공간 |
|------|---------|------|----------|
| entry 추가 | 재생성 필요 | 기존 주소 유효 | capacity 내면 안전 |
| entry 삭제 | 재생성 필요 | orphan 주소 발생 가능 | 기존 데이터 디코딩 시 주의 |
| capacity 초과 | 빌드 에러 | — | 새 version 생성 필요 |
| version 승격 | 재생성 필요 | 두 version 공존 | 이전 주소 decode 가능 유지 |

entry 변경 전에 `getPrefixProfile(catalog, prefixId, version)`로 headroom을 확인한다. headroom이 0이면 capacity 확장(새 version) 없이 entry를 추가할 수 없다.
