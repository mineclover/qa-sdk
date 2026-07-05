---
def:
  id: taxonomy-engine-lifecycle-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: state
  aspect: lifecycle
  tier: component
  depth: specification
  sources:
    - packages/taxonomy-engine/src/schema/ir.ts
    - packages/taxonomy-engine/src/schema/zod.ts
    - packages/taxonomy-engine/src/validate/lifecycle.ts
    - packages/taxonomy-engine/src/diff/index.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-schema.test.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-diff.test.ts
    - packages/cli/src/commands/taxonomy/validate.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-lifecycle
---

# Lifecycle — 결정 진행 상태

> axis/entry에 선택적으로 부여하는 결정 상태. 확정 vocabulary와 아직 결정 중인 placeholder를 같은 taxonomy 안에 표현한다.

## 목적 ^purpose

- 진화 중인 taxonomy에서 확정/검토/미정 entry를 명시한다.
- `validate()`가 lifecycle 누락과 tbd orphan을 진단하게 한다.
- diff/migration 단계에서 lifecycle과 decisionLink 변경을 별도 영향으로 추적한다.

## 정의

`Lifecycle`은 6개 값이다.

```typescript
type Lifecycle =
  | "draft"
  | "review"
  | "approved"
  | "deprecated"
  | "archived"
  | "tbd"
```

`AxisIR.lifecycle`과 `EntryIR.lifecycle`에 선택적으로 들어간다. relation과 constraint에는 lifecycle 필드를 두지 않는다.

## 6 값

| value | 의미 |
|-------|------|
| `draft` | 초안, 작성 중 |
| `review` | 검토 중 |
| `approved` | 승인, 결정 완료 |
| `deprecated` | 폐기 예정, 새 사용 금지 |
| `archived` | 보관 |
| `tbd` | 미정 placeholder |

앞 5개 값은 definition-catalog `DEF_LIFECYCLE`과 맞는 공용 lifecycle이고, `tbd`는 taxonomy-engine이 미정 vocabulary를 표현하기 위해 추가로 허용한다.

## 적용 위치

```yaml
axes:
  layer:
    description: lesson-builder Layer
    lifecycle: approved
    entries:
      - { id: type-schema, address: 0, lifecycle: approved }
      - { id: asset, address: 1, lifecycle: approved, decisionLink: "./decisions/asset.md" }
      - { id: cue, address: 12, lifecycle: tbd, placeholderReason: "interaction 정의 미정" }
```

## 누락 정책

`lifecycle` 필드는 optional이다. parser는 누락을 허용하고 IR에는 `undefined`를 보존한다.

| 시점 | 동작 |
|------|------|
| parse | 누락 OK |
| validate 기본 | `lifecycle-missing` warning |
| validate `{ lifecycleStrict: true }` | `lifecycle-missing` error |
| validate `{ strict: true }` | warning 전체가 error로 승격 |
| codegen | 값이 없으면 해당 필드가 생성 객체에서 생략 |

CLI에서는 `qa-sdk tax validate <file> --lifecycle-strict`가 `lifecycleStrict` 옵션을 켠다.

## tbd와 placeholderReason

`lifecycle: tbd` entry는 placeholder로 집계된다.

| 상황 | 진단 |
|------|------|
| tbd entry가 1개 이상 | `lifecycle-tbd` info, `meta.count` |
| tbd인데 `placeholderReason`과 `decisionLink`가 모두 없음 | `lifecycle-tbd-orphan` info |
| `placeholderReason` 또는 `decisionLink`가 있음 | orphan 진단 없음 |

`placeholderReason`은 자유 텍스트다. engine은 문자열 존재 여부만 본다.

## decisionLink

entry에 결정 컨텍스트를 연결하는 string이다. 현재 검증은 `validateLifecycle()` 안에서 수행한다.

| 형식 | 검증 |
|------|------|
| `http://...`, `https://...` | 형식만 허용. fetch 없음 |
| `tax:...` | 현재는 형식만 허용. registry resolve 없음 |
| `decision-flow://...` | Stage 3 미지원으로 `decision-link-broken` warning |
| 그 외 path | `decisionLinkBaseDir`가 있을 때 파일 존재 확인 |

CLI validate는 `decisionLinkBaseDir`를 yaml 파일의 directory로 넘긴다. 라이브러리 직접 호출에서 base dir을 생략하면 path 존재 확인은 skip된다.

## diff 확장

`diff()`는 lifecycle 관련 변경을 patch급으로 분류한다.

| DiffEntry kind | breakingLevel |
|----------------|---------------|
| `axis-lifecycle-changed` | `patch` |
| `entry-lifecycle-changed` | `patch` |
| `entry-placeholder-reason-changed` | `patch` |
| `entry-decision-link-changed` | `patch` |

## 다른 개념과의 관계

- [[entry]]: lifecycle을 갖는 주된 단위
- [[axis]]: axis 단위 lifecycle을 선택적으로 가짐
- [[diagnostic]]: `lifecycle-*`, `decision-link-*`
- [[semver-migration]]: lifecycle 변경은 patch, decisionLink가 있는 entry 영향은 `decisionImpact`
- [[doctor]]: definition-catalog vocabulary 추출에서 lifecycle vocabulary를 비교한다

## 참조

- 타입: `packages/taxonomy-engine/src/schema/ir.ts`
- schema: `packages/taxonomy-engine/src/schema/zod.ts`
- validate: `packages/taxonomy-engine/src/validate/lifecycle.ts`
- diff: `packages/taxonomy-engine/src/diff/index.ts`
- CLI validate: `packages/cli/src/commands/taxonomy/validate.ts`
- DEF_LIFECYCLE: `packages/definition-catalog/src/vocabulary.ts`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/lifecycle-schema.test.ts __tests__/unit/lifecycle-validate.test.ts __tests__/unit/lifecycle-diff.test.ts __tests__/unit/diff-semver.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
