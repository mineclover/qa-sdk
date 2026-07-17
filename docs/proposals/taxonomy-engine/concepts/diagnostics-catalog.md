---
def:
  id: taxonomy-engine-diagnostics-catalog
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: constraint
  aspect: tech_constraint
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: diagnostics-catalog
supersedes: -
superseded_by: -
sources:
  - packages/taxonomy-engine/src/schema/diagnostic.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/structure.ts
  - packages/taxonomy-engine/src/validate/capacity.ts
  - packages/taxonomy-engine/src/validate/ref.ts
  - packages/taxonomy-engine/src/validate/constraint.ts
  - packages/taxonomy-engine/src/validate/axis5q.ts
  - packages/taxonomy-engine/src/validate/lifecycle.ts
  - packages/taxonomy-engine/src/doctor/index.ts
  - packages/taxonomy-engine/src/drift/index.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/doctor.test.ts
---

# DiagnosticCode 카탈로그

## 목적 ^purpose

taxonomy-engine의 진단 코드는 CLI, 테스트, 문서에서 공유하는 안정 식별자다. 이 문서는
각 코드 prefix와 대표 코드를 한 곳에 고정해 구현 drift를 줄이고, 새 진단 추가 시 갱신해야
하는 카탈로그 역할을 한다.

전체 진단 코드를 한 표에. 새 코드 추가 시 여기도 갱신 필수.

## parse-*

| code | severity | 단계 | 언제 | meta 키 |
|------|----------|------|------|---------|
| `parse-yaml-syntax` | error | parse | yaml 문법 오류 (js-yaml/yaml lib parse error) | - |
| `parse-missing-axes` | error | parse | zod 검증 실패 — axes 필수 또는 기타 schema 위반 | - |

## structural-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `structural-empty-entries` | error | axis.entries가 빈 배열 | - |
| `structural-duplicate-id` | error | 같은 axis 안 entry id 중복 | `{ axis, duplicateId }` |
| `structural-duplicate-address` | error | 같은 axis 안 entry address 중복 | `{ axis, address, ids: [first, second] }` |

## capacity-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `capacity-headroom` | warning | `entries.length * 2 > capacity` | `{ entries, capacity, minRecommended }` |
| `capacity-overflow` | error | `entries.length > capacity` | `{ entries, capacity }` |

## ref-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `ref-broken` | error | relation rule이 존재하지 않는 entry id 참조 | `{ axis, missing, field }` |
| `ref-unresolved-import` | error | imports의 target taxonomy가 registry에 없음 | `{ missing, as, index }` |
| `ref-version-missing` | error | imports의 version과 registry version 불일치 | `{ taxonomy, requested, available, index }` |

## constraint-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `constraint-violated` | (변동) | constraint kind별 위반 | `{ constraint, ... kind별 추가 }` |
| `constraint-deprecated-string-rule` | info | string 형식 rule (구조화 형식 권장) | `{ constraint, currentRule }` |

## axis-5q-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `axis-5q-finite` | warning | axis name이 unbounded 가능성 (version, timestamp, uuid, id) | `{ axis, reason }` |

(미구현 — 후속: `axis-5q-decisional`, `axis-5q-stable`)

## version-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `version-drift` | warning | registry import 요청 version ≠ 실제 version | `{ taxonomy, requested, available, consumer, index }` |

(spec 예약: `version-incompatible-rename` — 미구현)

## codegen-*

| code | severity | 언제 | meta |
|------|----------|------|------|
| `codegen-content-hash-mismatch` | warning | caller가 이전 hash와 현재 hash 비교 시 다름 | `{ previous, current }` |

## doctor-* (v0.3 추가)

| code | severity | 언제 | meta |
|------|----------|------|------|
| `doctor-missing` | error | expected에 있는데 yaml에 없음 | `{ axis, missing }` 또는 `{ axis }` |
| `doctor-drift` | warning | yaml과 expected의 address 또는 label 불일치 | `{ axis, entry, yaml, expected, field? }` |
| `doctor-unexpected` | warning | yaml에 있는데 expected에 없음 | `{ axis, unexpected }` |

## lifecycle-* (v0.8 Stage 1 추가)

| code | severity | 언제 | meta |
|------|----------|------|------|
| `lifecycle-missing` | warning (strict: error) | entry/axis에 lifecycle 필드 없음 | - |
| `lifecycle-tbd` | info | placeholder(tbd) entry 집계 보고 | `{ count }` |
| `lifecycle-tbd-orphan` | info | tbd인데 placeholderReason과 decisionLink 둘 다 없음 | - |
| `lifecycle-transition-invalid` | error | git base 비교 시 부적절 전이 (예: `archived → *`) | (Stage 2) |

## decision-link-* (v0.8 Stage 1 추가)

| code | severity | 언제 | meta |
|------|----------|------|------|
| `decision-link-broken` | warning | decisionLink path/URI 해소 실패 | - |

상세 spec: [`lifecycle.md`](./lifecycle.md)

## 운영 가이드

- **code는 안정 식별자**. message는 변경 가능, code는 한 번 정하면 유지.
- CI/grep으로 안전하게 필터링하려면 code 사용.
- 새 진단 추가 시 이 카탈로그 갱신 필수 (drift 방지).

## 구현 증거 ^implementation-evidence

대표 코드들은 `packages/taxonomy-engine/src/schema/diagnostic.ts`의 `DiagnosticCode`
prefix 타입과 parser/validate/doctor/drift 구현에서 생성된다. `validate.test.ts`,
`lifecycle-validate.test.ts`, `doctor.test.ts`, `drift.test.ts`가 각 prefix의 대표
diagnostic을 고정한다.

다음 코드는 의도적으로 예약/후속 상태다.

- `axis-5q-decisional`
- `axis-5q-stable`
- `version-incompatible-rename`

검증 명령:

```bash
pnpm --filter taxonomy-engine test
pnpm --filter taxonomy-engine typecheck
pnpm --filter taxonomy-engine build
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
