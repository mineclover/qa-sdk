---
def:
  tier: component
  id: deterministic-label-registry-extraction-plan
  type: knowledge
  knowledge_kind: proposal
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [contract, decision, structural]
  links:
    - target: deterministic-label-stability-plan
      type: depends_on
    - target: doc-frontmatter-namespace
      type: depends_on
    - target: doc-metadata-field-ownership
      type: depends_on
    - target: deterministic-label-stability-boundary
      type: traces_to
    - target: docs-control-plane
      type: refines
---

# Deterministic Label Registry — 패키지 추출 계획

## 목적 ^purpose

`deterministic-label-registry`를 `@qa-sdk/cli` 내부 모듈에서 독립 라이브러리 패키지로 추출하는 작업을 3단계 순차 PRD로 분할한다. 단일 거대 PR로 ~60 파일을 한꺼번에 옮기면 리뷰·검증이 불가능에 가까워지므로, 의존 순서에 따라 3개 library를 순차 추출한다. 본 plan은 각 단계의 범위와 경계, 선행·후행 관계를 고정해 PRD 작성자들이 참조할 수 있게 한다.

## 배경 ^overview

`docs/specs/definition-catalog/deterministic-label-architecture.spec.md` 조사에서 다음이 확인되었다.

- 수집 계층은 이미 `packages/definition-catalog`로 단일화됨 (추출 필요 없음)
- 해석 계층은 `packages/cli` 안쪽에 흩어져 있음: `docs-control-plane/*`, `ontology-pack-validate*`, `deterministic-label-*`
- `deterministic-label-*`는 `DocumentEnvelope` 타입(192줄) + `family-scope`/`completed-records` 유틸(321줄) + `ontology-pack-validate` 함수들(263줄)에 의존
- CLAUDE.md 규칙: 라이브러리(unscoped)는 플랫폼 서비스(`@qa-sdk/cli`)를 import할 수 없음
- 따라서 `deterministic-label-registry`를 독립 라이브러리로 만들려면 의존하는 공용 코드들도 먼저 라이브러리로 올라가야 함

`docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md`에 흡수된 3축 결정(1A content-derived URN + 2C enum + gateEvidence + 3B dry-run event 결정론)은 패키지 추출과 직교한다. 즉 추출은 구조 작업이고, stability 증명은 계약 작업이다.

## 3단계 PRD

### C-1: `doc-envelope` 추출

**파일**: `tasks/prd-doc-envelope-extraction.md|json`

**이관 대상**:
- `packages/cli/src/lib/docs-control-plane/types.ts` (190)
- `packages/cli/src/lib/docs-control-plane/normalize.ts` (226)
- `packages/cli/src/lib/docs-control-plane/query.ts` (33)
- `packages/cli/src/lib/docs-control-plane/family-scope.ts` + test (159 + 테스트)
- `packages/cli/src/lib/docs-control-plane/completed-records.ts` + test (162 + 테스트)

**결과**: `packages/doc-envelope/` (unscoped library). `DocumentEnvelope` 타입 모델 + normalizer + query + 순수 scope 유틸.

**의존**: 없음 (definition-catalog은 별개, 이관 안 함).

**영향 범위**: ~48 cli 파일의 import 경로 변경.

**배경 원칙**: 수집 계층의 **데이터 모델**만 옮김. 해석(graph, drift, role-matrix, follow-ups, adapters)은 cli에 남김.

### C-2: `ontology-pack-validate` 추출

**파일**: `tasks/prd-ontology-pack-validate-extraction.md|json` (C-1 완료 후 작성)

**이관 대상**:
- `packages/cli/src/lib/ontology-pack-validate.ts` (203)
- `packages/cli/src/lib/ontology-pack-validate/**` (sub-modules: docs-readiness, file-readiness, load-pack, runtime-validation, types)
- `packages/cli/src/lib/known-ontology-packs.ts` (60)

**결과**: `packages/ontology-pack-validate/` (unscoped library). Pack validation + known pack registry.

**의존**: `doc-envelope` (C-1 결과, type 소비)

**영향 범위**: ~10 cli 파일 (ontology 명령, pack-authoring, scaffold 테스트들).

**이관 안 하는 이유**: ontology-pack-validate는 cli의 ontology 명령(`pack-authoring`, `activation`, `scaffold`)에서도 쓰임. 독립 library로 만들어야 cli와 deterministic-label-registry 양쪽이 import 가능.

### C-3: `deterministic-label-registry` 추출

**파일**: `tasks/prd-deterministic-label-registry-extraction.md|json` (C-2 완료 후 작성)

**이관 대상**:
- `packages/cli/src/lib/docs-control-plane/deterministic-label-candidates.ts` (1037)
- `packages/cli/src/lib/docs-control-plane/deterministic-label-records.ts` (556)
- `packages/cli/src/lib/docs-control-plane/deterministic-label-packs.ts` (338)
- `packages/cli/src/lib/docs-control-plane/deterministic-label-fsm.ts` (812)
- `packages/cli/src/lib/docs-control-plane/deterministic-label-inventory.ts` (349)
- `packages/cli/src/lib/docs-control-plane/deterministic-labels.ts` (68, barrel)
- `packages/cli/src/lib/docs-control-plane/deterministic-labels.test.ts` (1667)

**결과**: `packages/deterministic-label-registry/` (unscoped library). Read-only label projection + FSM readiness + transition dry-run.

**의존**: `doc-envelope` (C-1), `ontology-pack-validate` (C-2), `definition-catalog` (기존)

**영향 범위**: ~15 cli 파일 (docs-control-plane/index.ts barrel + deterministic-label-fsm/inventory의 내부 import + 테스트 파일 + 2-3 호출처).

**이관 후 상태**: `docs-control-plane/index.ts`는 `deterministic-label-registry`로부터 re-export (barrel compat). 이후 stability PRD는 새 패키지 내부에서 진행.

## 의존 순서 (필수)

```
C-1 (doc-envelope)
  ↓
C-2 (ontology-pack-validate)  ← doc-envelope 의존
  ↓
C-3 (deterministic-label-registry)  ← doc-envelope + ontology-pack-validate 의존
```

역순 불가. 각 PRD는 전 단계 완료를 전제로 시작.

## 공통 원칙

### 1. Zero behavior change

각 PRD는 **이관**만 수행. 타입/함수의 public API 변경 금지. 모든 테스트는 assertion 변경 없이 통과해야 함.

### 2. Barrel compat

기존 `docs-control-plane/index.ts` re-export는 보존. 외부 소비자가 내부 경로를 바꾸지 않아도 동작 유지. 개별 PR의 import 경로 변경은 cli 내부에 한정.

### 3. 검증 gate 표준화

각 PRD 모든 user story의 acceptance criteria에 다음 gate 포함:
- 해당 신규 패키지 build/test (있다면)
- `pnpm --filter @qa-sdk/cli typecheck`
- `pnpm --filter @qa-sdk/cli test -- docs`
- `pnpm --filter @qa-sdk/cli build`
- `node packages/cli/dist/index.js def validate` (경고 0건)
- docs status JSON smoke check (shape 불변)

### 4. Git 이력 보존

파일 이동은 `git mv`로 수행. 이력이 보존되어야 리뷰어가 실제 diff를 확인 가능.

### 5. README 최소화

각 신규 패키지는 1-line purpose + public API 요약만 README에 둔다. 상세 스펙은 spec 문서로 분리 (stability spec은 C-3 후 작성).

## 비목표

- 본 plan은 **stability 계약 자체를 정의하지 않는다**. 계약은 `deterministic-label-stability-boundary.memo.md` (결정 table 포함)와 이어질 spec 2종(`deterministic-label-coordinate-stability.spec.md`, `deterministic-label-projection-determinism.spec.md`)의 몫.
- 본 plan은 **새 기능을 추가하지 않는다**. 구조 추출만 다룸.
- 본 plan은 **상위 계층(graph-*, role-matrix, follow-ups, drift, adapters)의 이관을 포함하지 않는다**. 이들은 cli의 해석 계층으로 남음.
- 본 plan은 **JSON API 변경을 포함하지 않는다**. `docs status --json` 등 외부 계약 surface는 불변.

## 연계 산출물 순서

```
1. deterministic-label-architecture.spec.md (완료) — 조사
2. doc-metadata-field-ownership.rule.md (완료) — A단계
3. doc-frontmatter-namespace.spec.md (완료) — B단계
4. [본 plan] (현재) — 3단계 추출 계획
5. prd-doc-envelope-extraction.md|json (완료) — C-1
6. C-1 구현 완료
7. prd-ontology-pack-validate-extraction.md|json — C-2 (미작성)
8. C-2 구현 완료
9. prd-deterministic-label-registry-extraction.md|json — C-3 (미작성)
10. C-3 구현 완료
11. deterministic-label-coordinate-stability.spec.md — stability 계약 (C-3 이후)
12. deterministic-label-projection-determinism.spec.md — stability 계약 (C-3 이후)
13. stability PRD — 증명 구현
```

각 단계는 이전 단계 완료를 전제로 시작.

## 위험

### R-1. Import 경로 변경 규모

C-1에서 ~48 파일, C-3에서 ~15 파일의 import 경로가 변경된다. PR 크기가 크지만 **기계적 작업** — 리뷰는 import path 검증 + gate 통과 확인이 주.

완화: barrel compat으로 외부 소비자는 변경 안 받음. cli 내부만 변경.

### R-2. 중간 상태에서 stability 작업 진행 여부

C-1 완료 후 C-2/C-3 전에 stability 증명을 시작할 수 있는가? **할 수 있다** (cli 내부의 `deterministic-label-*`는 그대로 작동). 단 stability spec은 C-3 완료 후에 "패키지 내부 계약"으로 쓰는 게 자연스러움.

### R-3. ontology-pack-validate와 cli 명령의 결합

C-2에서 ontology-pack-validate를 추출하면 cli의 `ontology pack *` 명령들이 새 패키지를 import해야 함. 이 변경이 명령 동작에 영향 주지 않아야 함 (zero behavior change 원칙).

검증: C-2 PRD에 ontology pack 명령 smoke test를 gate로 포함.

### R-4. Deterministic-labels.test.ts 이관

C-3에서 1667줄 테스트 파일을 새 패키지로 이관. vitest 설정이 새 패키지에 맞게 작동해야 함.

완화: C-1에서 `doc-envelope`에 이미 테스트 이관을 수행 — 패턴을 선례로 활용.
