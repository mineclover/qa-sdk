---
def:
  id: taxonomy-engine-coordinate-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: data
  aspect: concept
  tier: component
  depth: specification
  sources:
    - packages/taxonomy-engine/src/schema/ir.ts
    - packages/taxonomy-engine/src/indexer/index.ts
    - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
    - packages/taxonomy-engine/src/ref/parser.ts
    - packages/taxonomy-engine/__tests__/unit/indexer.test.ts
    - packages/taxonomy-engine/__tests__/unit/query.test.ts
    - packages/taxonomy-engine/__tests__/unit/ref.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-coordinate
---

# Coordinate — 점

> 여러 [[axis]]의 [[entry]]를 동시에 지정한 좌표 튜플. 텍소노미 공간의 한 점.

## 정의

여러 axis의 entry를 묶은 튜플. 좌표 공간 안의 위치 하나. 시스템에서 다루는 모든 객체는 이 점들 중 하나에 거주.

## 목적

- 다축 분류의 한 객체를 단일 점으로 표현
- 점에 정수 주소를 부여(packing)해서 컴팩트한 영속 표현 가능
- 의미를 직교 차원의 곱으로 분해 → 새 차원 추가에 점진적 확장

## 구조 (개념)

```
{ axis1: entry-id, axis2: entry-id, ... }
```

각 키는 [[axis]]의 name, 각 값은 그 axis 안의 [[entry]] id.

예: `{ scope: apm, aspect: model, depth: layer }` → qa-sdk 좌표 공간의 한 점.

## 핵심 원리

### Cross-product 좌표

n 개의 axis가 있으면 좌표 공간의 잠재 점 개수는 각 axis capacity의 곱. 모든 점이 의미 있을 필요 없음 — sparse 공간 허용.

### Sparse cells

(scope=apm, aspect=model) 같은 일부 좌표만 실제 객체로 채워지고, 나머지는 빈 공간. 이게 직교 곱의 자유로움 — 새 axis를 추가해도 기존 점들은 그대로.

### Packed integer

axis 순서 + 각 axis의 capacity 비트 수가 정해지면, 좌표 → 단일 정수로 인코딩 가능. 영속 저장에 효율적. unpack은 정확히 역연산.

예: `(scope=apm, aspect=model)` → `0x00` (앞 2비트 scope, 다음 2비트 aspect)

### Address 기반 referential 안전

좌표는 entry id가 아니라 address로 packing되므로, id rename에 무관. 좌표를 코드/DB에 박아도 깨지지 않음.

### Partial coordinate (슬라이스)

일부 axis만 지정한 좌표는 "전체의 부분집합"을 가리킴. 예: `{ scope: apm }`은 scope=apm인 모든 점의 집합. 이건 [[relation]] from/to 에서 axis subset 지정에 활용.

## 다른 개념과의 관계

- [[axis]] — 좌표가 속한 차원들
- [[entry]] — 각 차원에서 선택된 좌표값
- [[relation]] — 좌표 → 좌표 매핑(화살표)의 정의역/공역
- [[taxonomy]] — 좌표가 살아있는 공간

## 사용 예시

lesson-builder-content:
- `(layer=clip, clip-template=appear-fade)` — "appear-fade 라는 clip 템플릿" 한 점
- `(layer=asset, asset-type=character, param-kind=content)` — "캐릭터 에셋의 콘텐츠 파라미터 영역"

[[relation]] `clip-binds-asset-control`은 첫 점 같은 부분좌표(`clip-template`)에서 두 번째 점의 부분좌표(`param-kind=control`)로 가는 화살표 모음.

## 참조

- spec: `docs/proposals/taxonomy-engine/00-design.md` §4.3, §5.2
- 좌표 packing 구현: `packages/taxonomy-engine/src/indexer/index.ts`
- 좌표 ref 문법: `packages/taxonomy-engine/src/ref/parser.ts`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/indexer.test.ts __tests__/unit/query.test.ts __tests__/unit/ref.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
