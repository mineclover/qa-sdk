---
def:
  id: task-spec-partial-binder
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: weighted-index
  tags: [task-record]
  links:
    - target: partial-binder-spec
      type: traces_to
sources:
  - docs/specs/weighted-index-system/partial-binder.spec.md
  - docs/specs/weighted-index-system/partial-binder-spec/partial-binder-api.spec.md
  - docs/specs/weighted-index-system/partial-binder-spec/partial-binder-math.spec.md
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
---

# partial-binder 스펙 작성

> 차원 부분 바인딩 모듈이 CLAUDE.md + docs/md에만 문서화. 전용 스펙 필요.

## 목적 ^purpose

partial-binder 스펙 작성 task의 완료 위치를 추적한다. 현재 SSOT는 `partial-binder-spec` 문서군과 `packages/weighted-index/src/vocab/partial-binder.ts`다.

## 우선순위: 🔴 8순위

## 현재 상태

- CLAUDE.md에 상세 기술 (createBinder, resolve, bind, 체이닝)
- `packages/weighted-index/docs/partial-binder.md` 존재 (API 문서)
- `docs/specs/weighted-index-system/partial-binder.spec.md` 존재
- 테스트: `partial-binder.test.ts` ✅ 존재

## 산출물

`docs/specs/weighted-index-system/partial-binder.spec.md`

## 범위

| 섹션 | 내용 |
|---|---|
| 목적 | 전체 경로 중 고정 차원 캐시 → 런타임 나머지만 계산 |
| 차원 경로 | namespace > name > env > device > region > shard > resource > action |
| API | createBinder, resolve, resolveId, bind (체이닝) |
| 원리 | mixed-radix 각 차원 기여분 독립 → partialQueryBase 분리 합산 |
| PrefixCodec 연동 | 라벨 → 1-based 인덱스 변환 내부 수행 |
| 멀티서비스 | 같은 codec + 다른 binder → 서비스별 독립 주소 공간 |

## 인덱스 업데이트

- `docs/specs/indexing/weighted-index/README.md` — partial-binder.spec.md 행 추가
