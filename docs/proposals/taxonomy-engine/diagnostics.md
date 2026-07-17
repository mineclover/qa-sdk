---
def:
  id: taxonomy-engine-diagnostics-policy
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: constraint
  aspect: tech_constraint
  tier: system
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: diagnostics-policy
sources:
  - packages/taxonomy-engine/src/schema/diagnostic.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/codegen/index.ts
  - packages/taxonomy-engine/src/doctor/index.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
  - packages/taxonomy-engine/__tests__/unit/doctor.test.ts
---

# Diagnostics — 에러 처리 + 진단 정책

> 00-design.md §7 분리. 이 문서는 정책/원칙이고, 구체 코드 목록은 [concepts/diagnostics-catalog.md](./concepts/diagnostics-catalog.md) 참조.

## 목적 ^purpose

- taxonomy-engine의 모든 검증/생성/SSOT 점검 결과를 하나의 `Diagnostic` 구조로 통일한다.
- CLI 출력과 라이브러리 호출자가 severity/code/ref/hint/meta를 같은 의미로 해석하게 한다.
- code는 안정 식별자로 유지하고 message는 사람용 설명으로 자유롭게 개선할 수 있게 한다.

## 7.1 Diagnostic 구조

```typescript
type Diagnostic = {
  severity: 'error' | 'warning' | 'info'
  code: DiagnosticCode               // 안정 식별자 (CI에서 grep 가능)
  message: string                    // 한국어 사람용
  ref?: string                       // Tier 1 path. 진단 위치
  location?: { file?: string; line?: number; column?: number }
  hint?: string                      // 수정 제안
  meta?: Record<string, unknown>     // code별 추가 정보
}
```

## 7.2 DiagnosticCode 카테고리

| code prefix | 단계 | 예시 | severity 기본 |
|-------------|------|------|--------------|
| `parse-*` | parse | `parse-yaml-syntax`, `parse-missing-axes` | error |
| `structural-*` | parse | `structural-duplicate-axis`, `structural-empty-entries` | error |
| `capacity-*` | validate | `capacity-headroom`, `capacity-overflow` | warning / error |
| `ref-*` | validate | `ref-broken`, `ref-unresolved-import`, `ref-version-missing` | error |
| `constraint-*` | validate | `constraint-violated`, `constraint-unknown-kind` | error |
| `axis-5q-*` | validate | `axis-5q-finite`, `axis-5q-decisional`, `axis-5q-stable` | warning |
| `version-*` | validate | `version-drift`, `version-incompatible-rename` | error |
| `codegen-*` | codegen | `codegen-content-hash-mismatch` | warning |
| `doctor-*` | doctor | `doctor-missing`, `doctor-drift`, `doctor-unexpected` | error / warning |
| `lifecycle-*` | validate | `lifecycle-missing`, `lifecycle-tbd`, `lifecycle-tbd-orphan` | warning / info / error |
| `decision-link-*` | validate | `decision-link-broken` | error |

**code는 안정 식별자** — 한 번 정한 code는 message가 바뀌어도 유지. CI/diff/문서 grep 안전.

## 7.3 fail 정책 (단계별)

| 단계 | 정책 | 이유 |
|------|------|------|
| `parse` | fail-fast — syntax/shape error에서 error result 반환 | 깨진 yaml로 후속 진행 무의미 |
| `validate` | **fail-collect** — 모든 진단 수집 후 반환 | 한 번에 다 보여줘야 수정 1회로 끝남 |
| `show` / `resolveRef` | **fail-open** — 해소 실패 시 `undefined`, throw 안 함 | 조회 throw 비용 큼. 호출자 분기 |
| `codegen` | fail-fast — validate errors=0 아니면 거부 | drift 위험 차단 |
| `doctor` | fail-collect — 모든 drift 수집 후 반환 | 실제 CI gate에서 일괄 확인 |

## 7.4 위치 정보

`parse`가 yaml line/column을 IR에 보존:
```typescript
EntryIR { id, address, label?, meta?, _loc?: { line, column } }
```
- `_loc`는 underscore prefix — IR 본질 아님 (codegen 출력에서 제거)
- 후속 IDE/LSP의 jump-to-definition 기반

## 7.5 ref 무결성 정책 정합

qa-sdk LinkType `broken-link = error` 답습:
- `ref-broken` → error (조회 못 하면 silent fail은 데이터 무결성 위협)
- `show` / `resolveRef`는 fail-open이지만 **validate가 게이트 책임**을 짊

## 7.6 진단 출력 예시

`tax validate` text 출력:
```
✖ qa-sdk-coordinate-system v1: 2 errors, 1 warning

  ERR  capacity-headroom
       qa-sdk-coordinate-system#/axes/scope
       entries=8, capacity=8 (need ≥ 16)
       hint: capacity를 16 이상으로 올리거나 entries를 분할하세요

  ERR  ref-broken
       qa-sdk-coordinate-system#/relations/depth-contains/rules/3
       lower="missing-entry" — axes/depth/entries에 없음

  WARN axis-5q-finite
       qa-sdk-coordinate-system#/axes/version
       entries unbounded — 5Q checklist '유한' 항목 미충족 가능
```

`tax validate --json` — `Diagnostic[]` JSON 직렬화 그대로.

## 참조

- 전체 진단 코드 목록: [concepts/diagnostics-catalog.md](./concepts/diagnostics-catalog.md)
- doctor 진단 (doctor-*): [concepts/doctor.md](./concepts/doctor.md)
- 에러 처리 컨벤션: `docs/specs/system/system-support/error-handling-convention.spec.md`
- qa-sdk LinkType 정책: `CLAUDE.md` §LinkType 사용 규칙

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/validate.test.ts __tests__/unit/lifecycle-validate.test.ts __tests__/unit/doctor.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
