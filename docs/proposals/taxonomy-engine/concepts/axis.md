---
def:
  id: taxonomy-engine-axis-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: data
  aspect: axis_catalog
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-axis
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/schema/zod.ts
  - packages/taxonomy-engine/src/validate/capacity.ts
  - packages/taxonomy-engine/src/validate/axis5q.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/__tests__/unit/schema.test.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/indexer.test.ts
---

# Axis — 차원

> taxonomy 좌표 공간의 한 방향. 텍소노미의 가장 기본적인 1급 개념.

## 정의

유한한 좌표값(Entry)들이 모인 한 방향. 정체성은 이름과 그 안의 entries.

## 목적 ^purpose

- 분류의 한 축을 명시적으로 선언 — "이 시스템은 이 차원으로 자른다"
- 좌표 공간의 직교성을 강제하는 단위
- entry 추가/제거의 lifecycle 경계 (version 단위)

## 구조 (개념)

| 속성 | 의미 |
|------|------|
| `name` | 차원의 이름 (예: `scope`, `aspect`). 좌표 표기에서 키 |
| `entries` | 이 차원이 허용하는 좌표값 목록 ([[entry]] 참조) |
| `capacity` | 좌표 공간의 폭 (정수 주소를 몇 비트로 인코딩할지) |
| `version` | entries 변경의 lifecycle (v1 → v2 시 bump) |

## 핵심 원리

### 직교성

axis끼리 서로 모른다. 한 axis의 entry가 다른 axis의 어떤 entry와 의미적으로 연관되어도, 그건 [[relation]]으로 표현하지 axis 안에 인코딩하지 않는다. 이 원리가 텍소노미의 일반화 능력의 근거.

### 유한성

axis는 **유한한** entries만 가져야 한다. unbounded (예: timestamp, uuid)는 좌표가 아니다. `validateAxis5Q()`는 이름상 무한 집합일 가능성이 큰 axis를 `axis-5q-finite` warning으로 표면화한다.

### Capacity headroom

`capacity ≥ entries.length * 2`. 즉 절반은 항상 비워둔다. 이유: entry 추가에 대한 여유. 이 규칙 위반은 `validateCapacity()`의 `capacity-headroom` warning으로 보고한다.

### Version은 정수, entries 변경의 경계

v1과 v2는 별개의 axis로 간주. 같은 이름(`scope`)이라도 entries가 다르면 다른 좌표 공간. cross-version 참조는 명시적 `@v<n>` 표기.

## 다른 개념과의 관계

- [[entry]] — Axis의 원소
- [[coordinate]] — 여러 Axis의 entry를 묶어 만든 좌표점
- [[relation]] — Axis 간/Entry 간 의미 화살표
- [[taxonomy]] — Axis의 묶음

## 사용 예시

qa-sdk-coordinate-system:
- `scope` (시스템 경계): apm, ingest, registry, ...
- `aspect` (측면): model, protocol, runtime, ...
- `depth` (추상 정도): overview, system, layer, component, entry
- `level` (분해 레벨): group, module, leaf
- `layer` (4계층): domain, operation, mediation, experience

이 5 axis의 직교 곱이 qa-sdk의 좌표 공간.

## 참조

- spec: `docs/proposals/taxonomy-engine/00-design.md` §4.3
- 시스템 철학: `docs/definition-system-philosophy.md`
- 5Q finite 검증: `packages/taxonomy-engine/src/validate/axis5q.ts`
- capacity 정책: `packages/taxonomy-engine/src/validate/capacity.ts`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/schema.test.ts __tests__/unit/validate.test.ts __tests__/unit/indexer.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
