---
def:
  id: taxonomy-engine-diagnostic-concept
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
role: diagnostic
sources:
  - packages/taxonomy-engine/src/schema/diagnostic.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/codegen/index.ts
  - packages/taxonomy-engine/src/doctor/index.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
---

# Diagnostic — 진단

> parse/validate/codegen/doctor가 공유하는 검증 결과 단위.

## 목적 ^purpose

- CLI, CI, IDE가 같은 구조로 문제를 소비하게 한다.
- 사람이 읽는 메시지와 기계가 의존하는 안정 code를 분리한다.
- lifecycle/decision-link처럼 운영 정책에 가까운 검증도 같은 진단 채널로 노출한다.

## 구조

```typescript
type Diagnostic = {
  severity: "error" | "warning" | "info"
  code: DiagnosticCode
  message: string
  ref?: string
  location?: { file?: string; line?: number; column?: number }
  hint?: string
  meta?: Record<string, unknown>
}
```

## DiagnosticCode

`DiagnosticCode`는 template literal union이다.

| prefix | 소유 단계 |
|--------|-----------|
| `parse-*` | parser |
| `structural-*` | parser/schema 구조 검증 |
| `capacity-*` | validate capacity |
| `ref-*` | validate registry/ref |
| `constraint-*` | validate constraint |
| `axis-5q-*` | validate 5Q checklist |
| `version-*` | validate/import version |
| `codegen-*` | codegen/drift helper |
| `doctor-*` | doctor |
| `lifecycle-*` | lifecycle validate |
| `decision-link-*` | decisionLink validate |

전체 카탈로그: [`diagnostics-catalog.md`](./diagnostics-catalog.md)

## fail 정책

| 단계 | 정책 |
|------|------|
| parse | fail-fast — syntax/shape error에서 parse result가 error로 종료 |
| validate | fail-collect — 모든 진단 수집 |
| show/resolveRef | fail-open — undefined 반환, throw 없음 |
| codegen | fail-fast — validate error가 있으면 `CodegenValidationError` |
| doctor | fail-collect — 외부 SSOT drift를 모두 수집 |

## 다른 개념과의 관계

- [[constraint]] 위반 -> `constraint-violated`
- doctor drift -> `doctor-{drift,missing,unexpected}`
- lifecycle 누락/placeholder -> `lifecycle-*`
- decisionLink 파일/프로토콜 문제 -> `decision-link-*`
- yaml syntax error -> `parse-yaml-syntax`

## 참조

- spec: `../00-design.md` §7
- 코드: `packages/taxonomy-engine/src/schema/diagnostic.ts`
- lifecycle validate: `packages/taxonomy-engine/src/validate/lifecycle.ts`
- 카탈로그: `diagnostics-catalog.md`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/validate.test.ts __tests__/unit/lifecycle-validate.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
