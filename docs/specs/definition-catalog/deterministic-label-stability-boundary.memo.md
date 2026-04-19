---
def:
  id: deterministic-label-stability-boundary
  type: knowledge
  knowledge_kind: adr
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [decision, contract, structural]
  links:
    - target: deterministic-label-stability-plan
      type: traces_to
    - target: deterministic-label-coordinate-stability
      type: traces_to
    - target: deterministic-label-projection-determinism
      type: traces_to
    - target: deterministic-label-real-repo-observation
      type: traces_to
---

# Deterministic Label Stability — 경계 결정 기록

## 날짜 ^purpose

2026-04-18. Stability PRD 구현 과정에서 두 개의 구조 결정을 내렸고, 각 결정의 근거 · 재고 trigger · 비고정(명시적으로 다루지 않은 것)을 기록한다. 이 memo는 stability 스펙 2종과 observation memo의 상위 요약 역할.

## 구성 ^overview

### Stability 계약 3축 결정 (2026-04-18)

| 축 | 선택 | 핵심 |
|----|------|------|
| 1. Identity | **1A** Content-derived URN | URN = source field의 순수 함수. `originalId`가 SSOT 보존. persistence 독립. |
| 2. State 표현 | ~~2C~~ → **제거** | 후속 단순화(2026-04-18)에서 FSM + `currentState` 전체 드롭. records는 상태 없는 투영. |
| 3. Event 스코프 | ~~3B~~ → **제거** | 후속 단순화에서 transition dry-run + event schema 모두 드롭. |

근거: ECS 비교에서 도출. 거부된 대안(1B Entity UID / 2B 독립 컴포넌트 / 3C 완전 persistence)의 상세는 git 이력 참조.

### 운영 경계 결정 (2026-04-18)

결정 1: Multi-source collision 분류 (Option D — code 분리) vs 생성 시점 dedupe(Option 3) 중 D 채택. 이후 단순화 과정에서 D도 단일화로 흡수.
결정 2: Snapshot fixture 없음 — git이 역사의 SSOT.

## 결정 1: Multi-source collision은 diagnostic code 분리로 처리

### 선택

`semantic-coordinate-multi-source` (warning) 코드를 추가해 다음 케이스를 `semantic-coordinate-collision-candidate` (error)와 분리한다:

- `kind: "definition-doc"` + `subtype: "family"` — 같은 family 역할 문서 N개가 family URN 공동 생산
- `kind: "prd-story"` (모든 subtype) — PRD markdown + ralph-prd-json 양 포맷이 같은 story URN 생산

### 거부된 대안 (Option 3 — dedupe at generation)

생성 시점에 family/story URN을 group-by로 1건만 emit해 중복 자체를 없애는 방식. 구조적으로 더 깔끔(detection 단순, records 1:1 URN, multi-source code 불필요)하지만 아래 3축에서 현재 필요성이 없다.

### 3축 평가 (2026-04-18 기준)

| 기준 | 현재 판정 |
|------|---------|
| Records 숫자에 의미를 부여하는 소비자 | **없음** — 현재 소비자는 회귀 테스트/분포 측정. "라벨 X 조회" 명령 아직 없음 |
| Adapter/kind 추가가 활발한가 | **아니오** — v1 kind 8종 frozen (coordinate-stability.spec §8). 새 kind = v2 breaking |
| Snapshot이 data shape SSOT인가 | **아니오** — 아래 결정 2에 따라 snapshot 자체가 없음 |

세 기준 모두 "Option 3 긴급성 낮음"으로 수렴. **Option D 수용**.

### Option 3 재고 trigger

다음 중 하나라도 발생하면 재평가:

1. `docs label inventory` / `docs label status <URN>` 같은 operator 명령이 PRD로 들어옴 — records를 "URN당 1건"으로 조회해야 하므로 중복이 의미 모호를 만듦
2. Append-only registry persistence 설계 착수 — 각 record가 row가 될 때 중복 row는 직접적 비용
3. 새 adapter/kind 로드맵 활성화 — `isExpectedMultiSource` whitelist를 반복 갱신해야 하는 상태가 되면 구조적 해결이 더 저렴

## 결정 2: Snapshot fixture 없음 — git이 역사의 SSOT

### 선택

`packages/cli/fixtures/deterministic-label-inventory-snapshot.json` 같은 커밋된 기준 파일을 **두지 않는다**. 결정론 증명은 "같은 세션에서 2회 실행 결과가 byte-identical" 로 대체.

### 근거

- **Snapshot을 기록하면 기록이 과하게 많아진다** (사용자 직접 지적, 2026-04-18). Stability가 재실행될 때마다 신호 없는 diff가 PR에 쌓이고, 이는 실제 회귀 신호보다 noise가 더 커지는 현상을 낳는다.
- 역사 기록은 **git** 소유: 과거 상태가 필요하면 해당 commit의 (code + source)를 복원해 `buildDeterministicLabelInventory`를 다시 돌리면 된다
- 결정론의 정의는 "같은 입력 → 같은 출력" — "과거 출력을 저장한다"가 아니다
- 커밋된 fixture는 **drift 생성원** — 실제 동작 변화가 없어도 재생성 timing 차이로 PR noise 발생
- Snapshot을 SSOT로 쓰는 외부 소비자가 현재 **없음** (결정 1의 3축 중 세 번째)

### 증명 메커니즘

`packages/cli/src/lib/deterministic-label-inventory-determinism-live.test.ts` (2 tests):

1. 같은 options로 `buildDeterministicLabelInventory` 2회 호출 → `JSON.stringify(a) === JSON.stringify(b)` 단언
2. 성능 budget <5s 단언 (현재 ~3.7s)

### Snapshot 재고 trigger

다음 중 하나라도 발생하면 재평가:

1. **외부 소비자**가 snapshot을 직접 읽기 시작 — dashboard, CI gate(외부 시스템), 다른 repo import
2. **Byte-identical 단언만으로 잡지 못하는 regression**이 발견 — 예: 같은 실행에서는 일관되지만 서로 다른 환경/시점에서 다르게 나오는 경우 (cross-machine 비교 필요)
3. **Recovery SLO 요구** — 과거 특정 시점의 정확한 state를 git 없이 복원해야 하는 요구 (현재로서는 git으로 충분)

## 추가 단순화 (2026-04-18 후속)

### FSM readiness + transition controller 전체 드롭 (2026-04-18 후속 단순화)

- `fsm.ts` 전체 파일 **제거** (`computeDeterministicLabelReadiness`, `computeDeterministicLabelRecordReadiness`, `dryRunDeterministicLabelTransition`, `DETERMINISTIC_LABEL_READINESS_GATES`, `DETERMINISTIC_LABEL_TRANSITION_EVENT_SCHEMA_CANDIDATE` 등)
- `DeterministicLabelRecord.currentState` 필드 + `DETERMINISTIC_LABEL_RECORD_STATES` enum 제거 — records는 상태 없는 순수 투영
- `Inventory.summary.byState` + `readinessComputed` 제거
- Operator-facing CLI surface (`docs label transition --dry-run`) 추가 계획 제거
- Write-mode transition controller 구상 자체 제거

이유: 해석 계약이 약하고 (spec coverage 얕음), 실제 소비자 0, 현재 부여된 가치보다 유지 부담이 큼. FSM 관점이 다시 필요하면 별도 설계/패키지에서 재개.

### Axis 통합 보류

- 라벨을 axis entry로 승격하는 구상 **무기한 보류**
- 현재 URN 문자열 모델이 실제 수요 충족
- Integer 주소/bit-index 통합을 요구하는 소비자 없음
- 1A(content-derived URN) 유지 — source 변경 시 URN 재계산

### Multi-source diagnostic 코드 단일화

- 이전: `semantic-coordinate-collision-candidate` (error) + `semantic-coordinate-multi-source` (warning) 분리
- 현재: `semantic-coordinate-collision-candidate` (warning) 단일
- 이유: records 숫자에 의미 없으므로 collision 분류도 분리할 유인 없음

### Ontology pack projection 분리

- `projectOntologyPackAndArtifactLabelRecords`, `buildOntologyPackLabelRecordFromValidateResult` **제거**
- `deterministic-label-registry`는 document envelope 투영만 담당
- Pack 결과를 라벨 record로 만들려면 caller가 `ontology-pack-validate` 호출 후 `inventory.extraRecords`로 주입
- 목적 단위 격리: label registry는 pack validation 로직을 소유하지 않음

### Non-determinism grep guard 제거

- Live 재실행 byte-identical 테스트가 진짜 보증 — grep 예방은 중복
- 제거 후에도 결정론 보증은 `determinism-live.test.ts`가 담당

## 적용하지 않은 단순화 (이익 없음으로 판단)

| 단순화 후보 | 기각 사유 |
|-----------|---------|
| FSM states 7→4~5 축소 | 소비자 0 (전 records RESOLVED 머묾). v1 frozen 계약 위반 = v2 bump + 대규모 테스트 수정. enum 개수는 코드 이해도에 영향 없음 — 단순함의 착시 |
| coordinate-stability + projection-determinism spec 통합 | 두 spec이 다른 질문에 답함. 통합 시 정보 찾기 악화. 서로 링크로 엮여 현재도 충분 |
| stability-decision + stability-boundary + real-repo-observation memo 통합 | memo는 시점별 의사결정 snapshot — 압축 시 시간 축 손상. 독립 deep-link 가치 상실 |

**원칙**: 이익 없는 단순화는 하면 더 복잡해진다. 실제 소비자 요구나 구조적 문제가 확인되면 재평가.

## 고정되지 않은 것 (intentionally open)

### records 1:N per URN

Multi-source URN의 경우 records에 같은 label이 N건 남는다. 이것이 **버그 아님**이며 현재는 의미 있는 데이터(물리 기여 증거). Option 3로 갈 때 1:1로 정리. 지금은 그대로.

### multi-source 카테고리 확장

새 multi-source 패턴 발견 시 `isExpectedMultiSource`의 whitelist를 **확장**한다. 현재 2종(family, prd-story). 추가 시 결정 1 재고 trigger의 3번 조항 참조.

### Cross-machine 결정론

현재 증명은 single-machine / single-session 안에서만 byte-identical을 단언. 서로 다른 OS/locale/Node 버전에서도 동일한지는 별도 과제. Snapshot 재고 trigger 2번 조항이 이 요구를 catch.

## 상태

- **Stability PRD**: 위 결정을 반영해 US-004 제거 + US-005 live-rerun으로 재정의 (`tasks/prd-deterministic-label-stability.md`)
- **Observation memo**: snapshot 없음 원칙 반영
- **구현**: `deterministic-label-inventory-determinism-live.test.ts` 제공, `*-snapshot.test.ts`/fixture/script 제거
- **Operational gate**: cli tests 496 pass, typecheck/build/def validate 전부 통과
