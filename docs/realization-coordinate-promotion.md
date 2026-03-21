# Realization Plan: 좌표 승격 파이프라인

> Status: planning
> DKG-Ref: (작성 후 등록)
> Created: 2026-03-21
> Last verified: —

## 1. 배경

현재 축/prefix 추가는 사람이 `demo-catalog.ts`를 직접 편집한다. 시스템이 운영 데이터에서 패턴을 발견해도, 좌표 구조에 반영하려면 수동 작업이 필요하다.

시스템 내부에 좌표화되지 않은 구조적 데이터가 이미 존재한다:

| 위치 | 데이터 | 현재 수준 | 좌표화 가능성 |
|------|--------|----------|-------------|
| ObservationNode.source | `"metric"\|"manual"\|"review"\|"runtime"` | Level 1 (열거형) | 이미 dkg_event에 근접 |
| DecisionNode.id 패턴 | `DEC-CAPACITY`, `DEC-SEP`, `DEC-MERGE` 등 | Level 0 (문자열) | 의사결정 유형 축 후보 |
| DKG edge type | `composes(83)`, `contains(52)`, `observes(40)` 등 18종 | Level 1 (열거형) | 그래프 활동 축 후보 |
| phantom entries | coverage 분석에서 "정의 없이 관측된" entry | Level 0 | entry 확장 후보 |
| 테스트 파일명 → api_surface | FILE_TO_SURFACE 매핑 테이블 | 수동 매핑 | 자동 추론 후보 |

## 2. 승격 수준 정의

```
Level 0: 비구조 문자열
  "role 축 headroom이 부족하다" ← observation finding 텍스트
  → 자연어. 검색만 가능. 집계/비교/추세 분석 불가.

Level 1: 열거형 필드
  source: "metric" | "manual" | "review"
  → 타입으로 제한됨. 코드에서 분기 가능. 하지만 주소가 아님.
  → 집계: 가능 (Map<string, count>). 추세/스큐/커버리지: 불가.

Level 2: 좌표축 (DEMO_CATALOG의 axis)
  dkg_op: ["claim", "release", "decide", ...]
  → 정수 인코딩 가능. 다른 축과 조합 가능. capacity 관리됨.

Level 3: 좌표 주소 (prefix의 N-D 좌표)
  dkg_event:v1:42
  → 1D 정수. 스냅샷 저장. convergence 분석 전체 적용 가능.
  → skew, coverage, temporal trend, causality 모두 작동.
```

## 3. Gap

| # | Gap | 현상 | 필요한 것 |
|---|-----|------|----------|
| P1 | Level 1 → Level 2 승격 기준이 코드화되지 않음 | 5Q 체크리스트가 문서(axis-decision-guide.md)에만 존재. 사람이 읽고 판단 | 5Q를 코드로 구현하여 자동 판정 |
| P2 | Level 1 데이터의 패턴 발견이 없음 | DKG 노드의 열거형 필드가 convergence 분석을 받지 못함 | 열거형 필드를 스캔하여 축 후보 제안 |
| P3 | phantom entry → axis entry 확장 경로가 없음 | coverage 분석이 phantom을 감지하지만 "추가하라"는 제안만 하고 실행 안 함 | phantom → safeEntryAdd → observation → decision 자동 파이프라인 |
| P4 | 새 prefix 생성이 완전 수동 | 축 조합이 반복 관측되면 prefix로 묶어야 하는데 사람만 판단 | co-occurrence 기반 prefix 후보 제안 |
| P5 | catalog 업데이트 경로가 없음 | 승격이 결정되어도 demo-catalog.ts를 수동 편집해야 함 | codegen 또는 migration 경로 |

## 4. 설계

### Phase A: 5Q 자동 판정기

열거형 값 집합을 받아 5Q 체크리스트를 자동 평가한다.

```typescript
interface PromotionCandidate {
  field: string;           // 예: "observation.source"
  values: string[];        // 예: ["metric", "manual", "review", "runtime"]
  source: "dkg-node" | "event-key" | "phantom" | "co-occurrence";

  // 5Q 자동 판정
  q1_finite: boolean;      // 유한한가? values.length로 판단
  q2_decision: boolean;    // 의사결정에 사용되는가? DKG에서 이 필드로 분기하는 로직 존재 여부
  q3_shared: boolean;      // 여러 prefix/domain에서 공유되는가? 사용처 카운트
  q4_stable: boolean;      // 안정적인가? 최근 N일간 값 집합 변화 여부
  q5_capacity: number;     // capacity 추정치: nextPowerOf2(values.length * 2)

  verdict: "promote" | "keep" | "review";
  reason: string;
}

function scanPromotionCandidates(graph: GraphRegistry): PromotionCandidate[];
```

입력 소스:
- DKG 노드 필드 (observation.source, decision.lifecycle, constraint.lifecycle 등)
- event_key 패턴 (`dkg:claim:prefix:permission` → `dkg`, `claim`, `prefix`, `permission` 4개 토큰)
- phantom entries (coverage 분석 결과)

#### A-1: DKG 노드 필드 스캔

DKG 노드의 모든 열거형 필드를 추출하여 값 분포를 분석한다.

- Files: `spec-core/src/convergence/promotion-scanner.ts` (신규)
- Verify: `scanPromotionCandidates(graph)` 가 후보 목록 반환

#### A-2: 5Q 자동 판정

각 후보에 대해 5개 질문을 코드로 평가한다.

- Q1 (유한): `values.length <= 32` → true
- Q2 (의사결정): 이 필드 값에 따라 DKG에서 다른 처리를 하는 코드가 있는가 → graph에서 이 값이 edge/node 생성 조건에 사용되는지
- Q3 (공유): 이 값이 2개 이상의 prefix/domain에서 관측되는가
- Q4 (안정): 최근 3회 스캔에서 값 집합이 동일한가
- Q5 (capacity): `nextPowerOf2(values.length * 2)`

#### A-3: CLI 명령

```
dkg promote scan              — 승격 후보 스캔
dkg promote evaluate <field>  — 특정 필드 5Q 상세 판정
```

### Phase B: phantom → entry 확장 파이프라인

coverage 분석의 phantom entries를 safeEntryAdd 체인에 연결한다.

#### B-1: phantom 수집

self-check의 convergence 분석에서 phantom이 감지되면 `PromotionCandidate`로 변환.

#### B-2: safeEntryAdd 연결

phantom entry가 5Q를 통과하면 `safeEntryAdd` skill을 호출하여 headroom/stride-break/constraint 판정.

#### B-3: observation 생성

판정 결과를 observation으로 기록. 사용자가 `dkg decide`로 승인하면 catalog 업데이트.

### Phase C: co-occurrence → prefix 후보 제안

축 조합이 반복적으로 함께 관측되면 prefix로 묶는 것을 제안한다.

#### C-1: co-occurrence 패턴 분석

`aggregateUsageData`의 coOccurrence에서 반복 조합 감지.
현재 self-check에서 coOccurrence가 0건인 이유: 빌드와 테스트가 별도 record. 같은 record에 여러 prefix가 있어야 co-occurrence 발생.

#### C-2: 조합 → prefix 후보

2개 이상의 축이 항상 함께 사용되면 prefix 후보로 제안.

### Phase D: catalog 업데이트 경로

승격이 결정되면 demo-catalog.ts를 자동 생성하거나 마이그레이션을 수행한다.

#### D-1: diff 생성

현재 catalog vs 승격 후 catalog의 diff를 생성.

#### D-2: codegen

diff를 demo-catalog.ts에 적용하는 코드 생성. 또는 CLI 명령으로 `dkg promote apply`.

#### D-3: 검증

변경 후 `verifyRoundTrip` + `dkg self-check`로 정합성 확인.

## 5. Fitness Criteria

| # | 기준 | Verify |
|---|------|--------|
| F1 | `dkg promote scan`이 최소 3개 승격 후보를 반환 | `dkg promote scan \| grep "promote\|review"` |
| F2 | 5Q 자동 판정이 기존 축과 일치 | 이미 좌표화된 값(dkg_op 등)에 대해 "promote" 반환 |
| F3 | phantom entry가 감지되면 observation 생성 | `dkg self-check`에서 phantom > 0일 때 observation 후보 표시 |
| F4 | catalog 변경 diff가 생성됨 | `dkg promote evaluate <field>` 에서 diff 출력 |

## 6. 우선순위

**Phase A가 핵심.** 5Q 판정기가 있으면 나머지는 데이터를 넣어주기만 하면 된다.

Phase A만 구현하면:
- `dkg promote scan` → "observation.source는 이미 Level 1이고 5Q 전부 통과. 축 승격 권장"
- `dkg promote scan` → "decision ID의 DEC-CAPACITY/SEP/MERGE 패턴은 5Q 통과. 의사결정 유형 축 후보"
- 사용자가 판단 → `dkg decide` → catalog 수동 업데이트 (Phase D는 나중)

Phase B-C는 실제 트래픽이 더 쌓인 후에 의미.
Phase D는 catalog 자동 수정이므로 가장 나중.

## 7. 되돌림 조건

- 5Q 자동 판정이 false positive를 대량 생성 → Q2/Q3 기준 강화
- 승격 후보가 너무 많아 노이즈 → threshold 조정 (최소 사용 횟수 등)
- catalog 자동 수정이 기존 주소를 깨뜨림 → Phase D에서 verifyRoundTrip 필수
