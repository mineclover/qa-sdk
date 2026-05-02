---
def:
  id: deterministic-label-real-repo-observation
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, testing, decision]
  links:
    - target: deterministic-label-projection-determinism
      type: traces_to
    - target: deterministic-label-coordinate-stability
      type: traces_to
---

# Deterministic Label — 2026-04-18 Real-Repo Observation

## 날짜 ^purpose

2026-04-18. Stability PRD US-002 실행 결과 기록. `buildDeterministicLabelInventory`를 repo root에 대해 1회 실행 후 분포를 포착. 이 관찰은 snapshot 커밋(US-004) 전의 baseline이며, snapshot 규모 / 성능 상한 / P3 조건부 수정 후보 판단의 근거가 된다.

## 실행 조건 ^overview

```bash
cd packages/cli
npx tsx scripts/stability-exploration.ts
```

- rootDir: `/Users/junwoobang/workflow/qa-sdk` (repo root)
- adapters: `createDeterministicLabelInventoryAdapters` 기본 5종 (definition-markdown / prd-markdown / ralph-prd-json / ralph-session / artifact-evidence)
- readDocsFamily: `readDocsFamilyFromDefinitionMarkdown`
- `detectCompletedRecords: true`, `includeOntologyPacks: true`, `computeReadiness: true`

## 핵심 수치

| 지표 | 값 |
|------|---|
| wall-clock | **3,844 ms** (< 5,000 ms 목표치) |
| documents | 1,128 |
| records | 5,128 |
| candidates | 5,128 |
| diagnostics | 5,383 |
| skippedDocuments | 16 |
| completedRecords | 2 |
| packValidations | 2 |

## 분포

### by kind

| kind | count |
|------|-------|
| definition-doc | 3,165 |
| source-file | 1,363 |
| prd-story | 541 |
| ralph-prd-json | 34 |
| prd-markdown | 23 |
| ontology-pack | 2 |
| artifact | 0 |
| evidence | 0 |

### by state

| state | count |
|-------|-------|
| RESOLVED | 5,128 |
| DRAFT/LINTED/ACTIVE/DEPRECATED/ARCHIVED/BLOCKED | 0 |

→ 모든 record가 `RESOLVED`에 머물러 있음. ACTIVE 전이는 아직 발생하지 않았으며, 이는 현재 write-mode controller가 없어 당연한 상태.

### by diagnostic severity

| severity | count |
|---------|-------|
| error | 5,132 |
| warning | 255 |

### by diagnostic code

| code | count |
|------|-------|
| deterministic-label-readiness-blocked | ~5,100+ |
| semantic-coordinate-collision-candidate (warning) | ~250 |
| ontology-pack-readiness-warning | 2 |

**주**: 초기 스캔에서 collision 253건이 관찰되었으며, 분석 결과 전부가 의도된 multi-source(definition family + prd-story md/json pair). 이후 단순화 과정에서 multi-source 분류 제거 + collision을 warning severity로 통일 (2026-04-18 후속). 이 수치는 baseline 참고용이며 정확한 실시간 값은 `scripts/stability-exploration.ts` 재실행으로 확인.

### skip reasons

| reason | count |
|--------|-------|
| archive | 15 |
| transient | 1 |

## 해석

### 1. 성능 — 여유 있는 합격

3.8s는 <5s 상한 아래. record 5,128건 기준 iteration 당 ~0.75ms. 현재 repo 규모에서 성능 PRD 목표 달성 여유.

### 2. 5,128건 `deterministic-label-readiness-blocked` — 예상 동작

- 모든 record가 `RESOLVED` 이상으로 전이하려면 drift-free + evidence + role-quality + pack runtime 조건 필요
- 현재 5,128건 전부가 `RESOLVED → ACTIVE` 게이트에서 블록된 상태 = 정상
- 실제 write-mode controller가 도입되기 전까지 expected

### 3. 253 multi-source — 조사 후 의도된 동작으로 재분류 완료

처음 관찰 시 253건이 `semantic-coordinate-collision-candidate` (error)로 잡혀 P3 조사 대상이었으나 상세 분석 결과:

- **39건**: `urn:def:family:*` — 같은 family(`docs-control-plane` 등)의 여러 role 문서(spec/todo/plan/rule)가 공동으로 family URN을 생산. 의도된 다중 매핑.
- **214건**: `urn:prd:story:*` — PRD가 markdown(`prd-*.md`)과 ralph-prd-json(`prd-*.json`) 양 포맷으로 존재할 때 같은 story(US-001 등)가 양쪽에서 생성. 의도된 다중 표현.

두 카테고리 모두 "하나의 conceptual entity가 여러 physical 파일로 표현"되는 정상 상태이며, rename/중복 충돌과 구분되어야 한다. `semantic-coordinate-multi-source` (warning) 코드로 분리 완료. `deterministic-label-coordinate-stability.spec.md`의 "multi-source 예외" 절에 기록.

**진짜 에러-레벨 collision은 0건**. P3 추가 작업 불필요.

### 4. 2 ontology-pack readiness warnings — 기존 관찰치

pack 2개 모두 warning 1건씩. pack validate의 docs readiness 관련. 별도 조사 필요 없음 (pack authoring 영역).

### 5. skippedDocuments 16건 — archive 정책 동작 확인

- archive 15건: `tasks/archive/` 아래 PRD (expected)
- transient 1건: `.ralph-tui/session-meta.json` (expected — ralph-tui-integration의 `metadata.transient` 플래그)

## Snapshot 없음 — git을 역사의 SSOT로 둔다

초기 PRD는 `packages/cli/fixtures/deterministic-label-inventory-snapshot.json` 커밋을 포함했으나 다음 원칙에 따라 **제거됨**:

- 역사 기록은 **git** 소유 — 과거 상태가 필요하면 과거 commit의 (code + source)를 복원해 재생성 가능
- 결정론의 정의는 "같은 입력 → 같은 출력"이지 "과거 출력을 보관한다"가 아님
- 커밋된 fixture는 drift 생성원 — 실제 변화가 없어도 재생성 timing에 따라 noise 발생

대신 **live 재실행 동등성**으로 증명한다: 같은 실행 세션 안에서 2회 연속 호출 결과가 byte-identical 인지 단언.
구현: `packages/cli/src/lib/deterministic-label-inventory-determinism-live.test.ts`

## 후속 작업

### P3 — 조사 결과 "작업 불필요"

초기에 P3 PRD 후보로 등록된 collision 253건은 조사 후 모두 의도된 multi-source로 판명. `semantic-coordinate-multi-source` 코드 도입으로 분류 정정 완료. 추가 PRD 없음.

### US-004 snapshot 커밋

- 크기 감안해 kind별 분할 불필요 (≤ 3MB 예상)
- 단일 `packages/cli/fixtures/deterministic-label-inventory-snapshot.json`으로 진행
- P3의 collision 상태 그대로 snapshot에 기록 — 수정은 별도 PRD에서

## 규모 회귀 감지

본 관찰을 baseline으로 삼아 다음 조건 중 하나라도 발생하면 조사 트리거:

- wall-clock > 5,000 ms
- records count > 20,000 (4배 증가)
- `semantic-coordinate-multi-source` warning > 500 (2배 증가)
- **`semantic-coordinate-collision-candidate` error > 0** (진짜 충돌 발생 — 즉시 조사)
- skipReasons에 `transient`/`archive` 외 새 값 등장
- byKind에서 `artifact`/`evidence`가 0에서 급증 (감지 경로 변경 가능성)
