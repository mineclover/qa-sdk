---
def:
  id: deterministic-label-stability-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [contract, decision, observability]
  links:
    - target: deterministic-label-registry-fsm-plan
      type: refines
    - target: docs-control-plane
      type: depends_on
    - target: definition-catalog-spec
      type: depends_on
---

# Deterministic Label Stability — 정의 방법 탐색 계획

## 목적 ^purpose

"좌표 안정성"과 "투영 결정론"을 증명하는 PRD를 쓰기 전에, **어떤 방식으로 정의할 것인가**를 먼저 결정한다. 정의 방법이 고정되지 않은 상태에서 테스트를 쓰면 임의의 현재 동작을 잠그게 되어 계약이 아닌 회귀 덫이 된다. 따라서 본 plan은 가능한 정의 방법을 탐색·비교해, 이어지는 spec과 PRD의 근거를 만든다.

## 현재 판단

직전 PRD `deterministic-label-registry-fsm-read-model`은 read-only projection + FSM readiness + 전이 dry-run을 완성했다. 그러나 증명은 fixture 수준에 머물렀고, 다음은 계약으로 명시되지 않았다.

1. 좌표 형식이 v1으로 고정되었다는 선언 (edge case 완결성)
2. 같은 repo state → byte-identical output (결정론 계약)

둘은 맞물린다. 결정론을 증명하려면 좌표 형식이 먼저 고정되어야 하고, 좌표 형식을 고정하려면 실제 repo가 만드는 입력 분포를 봐야 한다. 본 plan은 이 의존을 풀기 위한 **정의 선행** 단계다.

## 선행 조건 (2026-04-18 추가)

본 plan은 [tier-redesign 제안](../../proposals/tier-redesign/)의 Phase 3 완료를 **선행 조건**으로 한다. 5-tier 체계(Component / Entry / FSM / System / Layout)가 확정되기 전에 stability spec을 작성하면, code-level 결정(특히 FSM 표현)과 doc-level tier 구조가 충돌할 수 있다. 재개 조건은 [01-migration.md](../../proposals/tier-redesign/01-migration.md)의 "Stability 작업 재개 조건" 섹션 참조.

> **참고**: 현재 tier-redesign 제안은 `docs/proposals/tier-redesign/`에서 격리 진행 중(RFC 단계). def graph에 포함되지 않으므로 본 plan의 frontmatter에 `depends_on` 링크는 없다. 수락(accepted) 후 정규 spec이 생성되면 그때 `depends_on`을 복원한다.

따라서 본 plan의 단계 실행은 현재 **보류**다. tier-redesign 제안 진행 중 참고 문서로 유지한다.

**결정 2C 매핑**: 결정 2C의 `currentState` enum + `gateEvidence[]`는 5-tier FSM 관점에서 다음으로 매핑된다 — **FSM document가 states의 SSOT**이고, **code enum은 FSM frontmatter `states[]`를 구현**한다. 즉 `deterministic-label-record-fsm.md`(미작성)가 정의한 states 리스트를 `DeterministicLabelRecordState` TypeScript enum이 따라야 한다. `def validate`가 동기 검증. FSM tier 설계 근거: [02-fsm-composition.md](../../proposals/tier-redesign/02-fsm-composition.md) §근거 7~8.

## 정의 대상

### A. 좌표 안정성 (Coordinate Stability)

- URN 형식의 frozen 계약
- 8 kind × domain × subtype × version 조합의 완결성
- subtype 추론 규칙 (12 확장자 + fallback 포함)
- collision 해결 결정론 (signature 정렬, preferred candidate 우선순위)
- Breaking vs additive 변경 분류
- 버전 충돌 시 migration policy

### B. 투영 결정론 (Projection Determinism)

- 입력 계약: 어떤 repo state input이 output에 영향을 주는가
- 출력 계약: 정렬 키, tie-breaker, diagnostic 순서
- 거부 대상 non-determinism: git untracked 파일, 환경변수, locale, timezone, 실행 순서
- Idempotency: 같은 input → byte-identical output

## 가능한 정의 방법

### A. 좌표 안정성

| 방법 | 개요 | 강점 | 약점 |
|------|------|------|------|
| A1. Enumeration | kind/domain/subtype을 `as const`로 닫음 | 현재 코드와 일치, 타입 안전 | subtype은 확장자에서 파생 — 무한 확장 가능 |
| A2. Grammar | URN을 BNF/정규식으로 선언, 모든 output 검증 | 형식적 정확성 | 파생 규칙은 별도 명세 필요 |
| A3. Canonical examples | 예시 URN을 frozen으로 선언 | 구체적, 리뷰 가능 | 완결성 증명 불가 |
| A4. Round-trip | `decode(encode(x)) = x` 증명 | 알고리즘적 | 일방 투영 모델엔 decode 없음 |
| A5. Version contract | v1 frozen, 변경은 v2 URN | 진화 경로 명시 | version 레지스트리 필요 |
| A6. Capability | projection이 해야/할 수도/해선 안 되는 작업 선언 | 기존 capability 패턴 정렬 | 규범성 약함 |

### B. 투영 결정론

| 방법 | 개요 | 강점 | 약점 |
|------|------|------|------|
| B1. Byte-identical snapshot | 전체 output을 JSON 스냅샷으로 고정 | 가장 강한 보증 | 모든 변경에 스냅샷 갱신 |
| B2. Content hash | canonicalized output hash 동등성 | 컴팩트 | 차이 확인 불가 |
| B3. Schema-stable | sort 키/구조 동등성 (byte 아님) | 형식 변경 유연 | 약한 보증 |
| B4. Property-based | 불변 속성(count, distribution, no new diagnostic) 테스트 | 의미 있는 속성 | 모든 회귀 못 잡음 |
| B5. Differential | 2개 구현 일치 | 알고리즘 drift 감지 | 구현 비용 2배 |
| B6. Canonical input + pure function | 입력 정규화 + 순수 함수 | 이론적으로 깨끗 | 형식 부담 |

## 기존 코드베이스 패턴 조사

아래는 비교 과정에서 재사용 가능성을 점검할 선행 패턴이다. 조사 후 본 plan에 매핑 결과를 덧붙인다.

- `generateCatalogTypes()` **contentHash** — 같은 catalog → 같은 hash (B2 + B6 조합의 선례)
- `docs/specs/apm-system/apm-schema-system/dsl-schema-versioning.spec.md` — DSL **versioning** 관례 (A5)
- **ADR-001~009** — 의사결정 기록 패턴 (memo로 근거를 남기는 형태)
- **Prefix capacity versioning** — headroom 기반 additive-first 진화 (A5 변형)
- **Vitest snapshot** — 기존 `__snapshots__/` 사용처가 있는지 확인 (B1 선례 여부)

## 비교 기준

| 기준 | 설명 |
|------|------|
| 표현력 | 계약이 의도를 정확히 담는가 |
| 리뷰 비용 | 변경 PR을 사람이 판단하기 얼마나 쉬운가 |
| 진화 경로 | 계약 확장 시 breaking 없이 가능한가 |
| 테스트 비용 | CI 실행 비용 |
| 운영 부담 | 스냅샷/버전 관리 등 부수 작업 |
| 증거 가치 | 계약 준수 증명으로서의 힘 |

## 초기 가설 (검토 필요)

비교 매트릭스 완성 전 초안 수준의 추천.

- 좌표 안정성: **A1 + A5 + A3** 조합
  - A1(enumeration)으로 현재 상태 잠금
  - A5(version contract)로 진화 경로 확보
  - A3(canonical examples)로 리뷰 가능한 surface 제공
- 투영 결정론: **B1 + B4** 조합
  - B1(byte-identical snapshot)으로 강한 보증
  - B4(property-based)로 의미 있는 회귀 방어

근거는 비교 매트릭스와 기존 패턴 조사 결과로 확정한다.

## 결정 (2026-04-18)

ECS 비교를 거쳐 3개 추가 결정 축(identity / state / event scope)이 도출되었고, 다음 조합으로 확정되었다.

- **1A**: Content-derived URN (source field의 순수 함수)
- **2C**: `currentState` enum + `gateEvidence[]` 게이트별 독립 근거
- **3B**: Dry-run event candidate도 결정론 계약에 포함

근거와 거부한 대안은 `deterministic-label-stability-boundary.memo.md` (결정 table 포함) 참조.

이 결정은 위 A/B 축 초기 가설(A1+A5+A3 / B1+B4)과 호환된다:
- A1/A5/A3은 "URN format 자체"의 안정성 방법 — 1A(content-derived)가 전제
- B1/B4는 "투영 출력"의 결정론 방법 — 2C/3B가 스냅샷 대상 범위를 확정

## 단계 (모두 완료, 2026-04-18)

1. ✓ **탐색** — 본 plan (방법 후보 A1~A6 / B1~B6)
2. ✓ **결정** — 3축 결정(1A/2C/3B)은 `deterministic-label-stability-boundary.memo.md`에 기록
3. ✓ **명세 고정** — `deterministic-label-coordinate-stability.spec.md` + `deterministic-label-projection-determinism.spec.md`
4. ✓ **PRD 실행** — `tasks/archive/prd-deterministic-label-stability.*` (US-004 취소, 나머지 완결)
5. ✓ **아키텍처 경계 반영** — `deterministic-label-architecture.spec.md` + CLAUDE.md + boundary test

각 단계는 이전 단계의 산출물을 근거로 참조한다 (spec → memo → plan).

## 장기 목표

좌표 안정성과 투영 결정론이 계약으로 고정되면 다음이 열린다.

- CLI surface (`docs label *`) 추가 시 안정된 read model을 전제로 설계 가능
- Service integration (definition-service, registry-service)에서 URN 공존 검증
- Persistence 결정(append-only registry) 시 "무엇을 저장할지"가 계약으로 이미 정의됨
- 드리프트 관찰은 계약 대비 편차로 정의됨 — ad-hoc 비교 아님

## 비목표

- 본 plan은 **선택하지 않는다**. 탐색·비교의 surface만 제공한다. 선택은 decision memo에서 이루어진다.
- 본 plan은 테스트/PRD 구현 방법을 다루지 않는다. 그것은 선택된 정의 방법이 고정된 뒤의 PRD 영역이다.
- 본 plan은 구현(P1/P2/P4)을 포함하지 않는다. 구현은 spec과 PRD가 갖춰진 뒤.
