---
def:
  id: prefix-path-summation
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-philosophy
      type: depends_on
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: meta-semantic-spacetime-uid
      type: depends_on
---

# Prefix 경로 합산 — 이벤트 분기의 명시적 표현

## 목적 ^purpose

PrefixDef의 주소 모델을 전곱(product)에서 경로 합산(sum)으로 확장하여,
이벤트의 분기 구조를 명시적 하위 계층으로 관리하는 카탈로그 표준을 정의한다.

## 정의 ^defines

- `AddressModel: "product" | "sum"` — prefix 주소 모델 선언
- `PathSegment` — consumes, shape, addressOffset, size, children?, transition?, routes?
- `AxisCondition` — 축 값 기반 분기 조건 (StateCondition 구조 재사용)
- `BranchRoute` — when(AxisCondition) + transition(EventTransition)
- `EventTransition` — eventKey + prefixId?
- `PrefixVersionDef.segments` — 버전별 세그먼트 구성
- `validatePrefixSegments(prefix, segments, catalog?, version?)` — consumes 부분집합 + route 축 + shape↔axis capacity 정합성
- `validateManifestSegments(catalog, manifestPrefixes)` — manifest publish 시 sum prefix segment 일괄 검증
- `detectPathSegments` — PipeGraph에서 PathSegment[] 자동 도출
- prefix-stamp sum 확장 — `model:sum seg:<id> consumes:[...]` 형식 스탬프, drift/migrate/find/impact 대응

## 소비 ^consumes

- `PrefixDef`, `PrefixVersionDef` (catalog.types.ts)
- StateCondition 구조 (spec-core/transition.types.ts) — AxisCondition으로 재사용

## 핵심 개념

**합산 = 이벤트 분기의 명시적 표현.** 전곱은 축이 동등하게 교차한다고 가정. 합산은 분기점에서 갈라진다고 명시. 관계 유무 무관 — axis pool에서 선택적 소비.

**분기 라우팅:** 축 값에 따라 다른 이벤트로 전이. route 매칭 > segment transition > undefined.

**버전 관리:** 세그먼트 구성은 `PrefixVersionDef.segments`에 저장. 주소는 발급 시점의 버전 스펙으로 디코딩.

**재귀:** children으로 무한 깊이. 비즈니스 흐름이 결정.

**전곱 = 합산의 특수 케이스:** segments 길이 1, consumes = 전체 labels.

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/catalog/catalog.types.ts` | PathSegment, AxisCondition, BranchRoute, EventTransition |
| `core/src/catalog/path-summation.ts` | createSegment, chainSegments, encodeBySegment, decodeBySegment, collectTransitions, productToSegment, validateSegments, validatePrefixSegments |
| `core/src/catalog/path-summation.test.ts` | 기본 테스트 (21) |
| `core/src/catalog/path-summation-example.test.ts` | 예시 + v1→v2 업그레이드 테스트 (36) |
| `core/src/pipe/pipe-segment.ts` | detectPathSegments — PipeGraph → PathSegment[] 자동 도출 |
| `core/src/pipe/pipe-segment.test.ts` | segment 도출 + prefix 검증 테스트 (9) |
| `cli/src/commands/prefix-stamp.ts` | stamp/drift/migrate/find/impact — sum 모델 확장 |

## 제약

```
CON-MS-009: segment 추가는 append-only (기존 offset 불변)
CON-MS-010: 같은 prefix 내 segment ID 유일
CON-MS-011: addressModel 선언 필수 (미선언 시 "product" 기본값)
CON-MS-012: "sum" prefix의 totalSize = Σ(segment sizes)
CON-MS-013: transition 대상 eventKey가 카탈로그에 존재해야 함
```

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/catalog/path-summation  # 47 tests
```
