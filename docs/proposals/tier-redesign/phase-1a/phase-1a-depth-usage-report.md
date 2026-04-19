---
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: phase-1a-evidence
phase: 1.A
topic: depth-field-usage
---

# Phase 1.A — `depth` 필드 사용처 조사

> 근거: 독립 에이전트 전수 grep/glob 조사 (2026-04-18).

## 요약

`depth`는 **상세도 축** (overview / specification / implementation / validation — **4값 enum**)으로 `scope × aspect × depth × lifecycle` 좌표 체계의 4번째 축이다. `docs/` 마크다운 1,056개 전수 사용 중이며, `contains-depth-violation` validation · CLI query 필터 · skill 워크플로우 전반에 참조됨. **권고: 유지**. 단 STC 4-tier(Component/Entry/System/Layout) 축과의 **역할 분담 명확화**는 Phase 1.B에서 필요.

## A. frontmatter 사용

- **파일 수**: 1,056 / 1,056 (100% — `def:` block 필수 필드)
- **값 분포**:

  | 값 | 개수 | 비율 |
  |---|---|---|
  | `specification` | 735 | 70% |
  | `overview` | 204 | 19% |
  | `validation` | 76 | 7% |
  | `implementation` | 45 | 4% |

- **대표 예시**:
  - `packages/definition-catalog/src/sample.test.ts:32` — `depth: "specification"`
  - `packages/definition-catalog/src/hierarchy.test.ts:73-83` — `depth: "overview"` (그룹 문서)
  - `packages/definition-catalog/src/validate.ts:169` — `depth !== "overview"` 필터 (contains 깊이 검증)

## B. 코드/도구 참조

- **읽기 위치**:
  - `packages/cli/src/data-sources/local-data-source.ts:44,359,381,444` — DB 칼럼 read
  - `packages/cli/src/commands/def.ts:201,693-718,753,860,923` — `def` 명령 출력 (조회/영향도)
  - `packages/cli/src/commands/quality.ts:336,353,393,450,1274,1295,1331` — 품질 감시
- **검증/경고 로직**:
  - `packages/definition-catalog/src/validate.ts:154-181` — **`contains-depth-violation`** (overview 문서에서 contains 체인 ≥4단계 경고)
  - `packages/definition-catalog/src/frontmatter.ts:164,200-203` — 4값 enum 검증
- **skill 참조**:
  - `skills/def-audit/SKILL.md:72,140,155` — "그룹 문서(depth: overview)에 구성 섹션 필수"
  - `skills/doc-lifecycle/SKILL.md` — lifecycle 단계별 depth 전환 (overview → spec → impl → validation)
  - `skills/def-new/SKILL.md:19,73,98` — 새 문서 생성 시 depth 필수 선택
  - `skills/spec-lifecycle/SKILL.md` — 구현 완료 후 specification → implementation 전환
  - `skills/def-split/SKILL.md:44,68` — 대형 문서 분할 시 overview 그룹 생성

## C. 실질적 의미

`depth`는 **상세도(detail-level)** 축으로, 같은 주제(scope × aspect 동일)라도 개요 / 명세 / 구현 / 검증은 다른 좌표를 가진다 (`vocabulary.ts:147-161`). 기능별 영향:

1. **contains 체인 제한** — `overview` 문서만 contains 루트 형성, 4단계 초과 시 warning
2. **좌표 공간 확장** — scope(16) × aspect(64) × depth(8) = 8,192 (catalog.ts:61)
3. **query 필터** — `--depth=specification` 같은 CLI 필터
4. **lifecycle 추적** — 구현 완료 시점에 specification → implementation 전환으로 진행 상태 표기

depth가 없으면 "그룹 vs 실제 명세" 구분이 사라져 contains 의미가 퇴색하고, 품질 감시/skill 워크플로우 대부분이 깨진다.

## 권고

| 옵션 | 영향 | 판정 |
|-----|------|------|
| **유지** | 좌표 4축 체계 그대로, 검증/필터/lifecycle 추적 정상 | ✓ **권장** |
| 재정의 (이름 변경 등) | 1,056 문서 마이그레이션 + 전체 도구 갱신 | ✗ 비효율 |
| 제거 | contains 의미 상실, 품질/skill 체계 파괴 | ✗ 비권장 |

**D-6 확정 권고**: `depth` 필드는 **유지**. STC tier 도입은 level → tier 축 **대체**이며 depth와 **직교** — 서로 교체 관계가 아님.

## STC 관점 보강 (Phase 1.B 결정 대상)

기존 이해("depth = contains 체인 깊이 정수")는 잘못됨. 실제론 **4값 enum(상세도)**. 따라서:

- `01-migration.md § 영향 범위` "depth 필드 재정의 또는 제거" 문구는 **"유지 확정"으로 갱신** 필요
- `03-decisions.md D-6` ("depth 운명") 결정 본문도 **유지 근거 + enum 값 명시**로 갱신 필요
- STC `tier` 축과 `depth` 축의 교차표 (예: `tier=system` × `depth=overview`가 자연스러운가?) → Phase 1.B 정합성 체크 대상

## 미확실 / 후속 조사 필요

1. **tier × depth 교차 정합성** — 예: Layout tier는 overview에만 허용? Component tier는 specification에만? 규칙 정의 필요
2. **`depth: number` 별개 필드 충돌** — meta-semantic scope-nesting 등에서 `depth: number` 사용처 네이밍 충돌 가능성(파일 경로 미확인)
3. **validation depth 76건 실사용 품질** — 전체 7%, 실제로 검증 계획 문서 작성 관례가 정착됐는지 표본 조사 필요
