---
def:
  id: meta-semantic-test-tracking
  level: module
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-data-contract
      type: depends_on
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
    - target: ms-concept-verification-unit
      type: depends_on
---

# 테스트 추적 — 패싯 단위 검증 루프

## 목적 ^purpose

테스트 케이스를 패싯 단위로 식별·수집하고, 검증 루프의 품질 지표로 관리한다.
각 테스트 케이스에 좌표를 부여하여 "어떤 패싯의 어떤 계약을 검증하는가"를 추적하고,
실행 결과를 이벤트로 수집하여 폐루프 품질 관리를 실현한다.

## 방법 ^method

**TestCase**가 검증 대상(패싯/파이프/계약)에 좌표로 연결되고,
**TestSuite**가 테스트 케이스를 패싯 단위로 그룹화하고,
**TestResult**가 실행 결과를 이벤트로 수집하고,
**TestContract**가 스펙 문서의 ^constraint에서 테스트 케이스로 연결하고,
**QualityMetrics**가 커버리지·통과율·drift를 품질 지표로 산출한다.

---

## 1. TestCase — 좌표가 부여된 테스트 단위

### 식별 체계

각 테스트 케이스에 prefix 기반 좌표를 부여한다:

```
test:{scope-index}:{aspect-index}:{facet}:{seq}

예시:
  test:1:3:소비:1     → feature/func_def의 소비 패싯 1번 테스트
  test:1:3:소비:2     → feature/func_def의 소비 패싯 2번 테스트
  test:5:1:관리:1     → constraint/tech_constraint의 관리 패싯 1번 테스트
```

### 타입 정의

```typescript
interface TestCase {
  /** 테스트 케이스 ID (유일) */
  testId: string;

  /** 좌표 주소 */
  address: string;          // "test:1:3:소비:1"

  /** 테스트 이름 */
  name: string;

  /** 검증 대상 */
  target: TestTarget;

  /** 기대 결과 */
  expected: TestExpectation;

  /** 연결된 스펙 문서 constraint */
  contractRef?: string;     // "data-contract.spec#호환성-규칙-3"

  /** 메타데이터 */
  scope: string;
  aspect: string;
  facet: string;
  tags?: string[];
}

/** 검증 대상 — 이 테스트가 무엇을 검증하는가 */
interface TestTarget {
  kind: "facet" | "pipe" | "contract" | "lineage" | "schema-version";

  /** facet: 특정 패싯의 동작 검증 */
  facet?: string;

  /** pipe: 특정 파이프/경로 검증 */
  pipeId?: string;
  flowPath?: string;

  /** contract: 스키마 호환 검증 */
  contractId?: string;

  /** lineage: 필드 계보 검증 */
  lineageTarget?: { schemaId: string; column: string };

  /** schema-version: 버전 호환 검증 */
  schemaId?: string;
  versionFrom?: string;
  versionTo?: string;
}

interface TestExpectation {
  /** 결과 유형 */
  type: "pass" | "fail" | "value" | "range" | "contains";
  /** 기대값 */
  value?: unknown;
}
```

---

## 2. TestSuite — 패싯 단위 그룹화

```typescript
interface TestSuite {
  /** 스위트 ID */
  suiteId: string;

  /** 대상 패싯 */
  facet: string;

  /** 대상 scope/aspect */
  scope: string;
  aspect: string;

  /** 포함된 테스트 케이스 */
  cases: TestCase[];

  /** 연결된 파이프 */
  pipeId?: string;

  /** 연결된 스키마 */
  schemaId?: string;
}
```

### 패싯별 스위트 예시

```
TestSuite "orders-소비" (facet: 소비)
  ├── test:1:3:소비:1 "주문 입력 정상 수신"
  ├── test:1:3:소비:2 "필수 필드 누락 시 거부"
  └── test:1:3:소비:3 "빈 주문 처리"

TestSuite "orders-관리" (facet: 관리)
  ├── test:5:1:관리:1 "재고 검증 통과"
  ├── test:5:1:관리:2 "재고 부족 시 실패"
  └── test:5:1:관리:3 "금액 범위 검증"

TestSuite "orders-생산" (facet: 생산)
  ├── test:1:3:생산:1 "주문 생성 성공"
  └── test:1:3:생산:2 "주문 번호 유일성"

TestSuite "orders-저장" (facet: 저장)
  ├── test:6:1:저장:1 "DB 저장 성공"
  └── test:6:1:저장:2 "UID 부여 검증"
```

---

## 3. TestResult — 실행 결과 이벤트 수집

테스트 실행 결과는 **이벤트**로 수집된다. meta-semantic의 이벤트 개념과 동일:
테스트 실행 = 이벤트 발생 → 결과 수집 → 품질 지표 산출.

```typescript
interface TestResult {
  /** 테스트 케이스 참조 */
  testId: string;
  address: string;

  /** 실행 결과 */
  status: "pass" | "fail" | "skip" | "error";

  /** 실행 시간 */
  duration: number;

  /** 실패 시 상세 */
  error?: string;

  /** 실행 시각 */
  executedAt: string;

  /** 실행 환경 */
  runner?: string;          // "vitest", "jest", "playwright"

  /** 매니페스트 버전 (어떤 스키마 버전에서 실행) */
  manifestVersion?: string;
}
```

### 이벤트로의 매핑

```
TestResult → EventRecord:
  event_key: "test_executed"
  payload: { testId, address, status, duration }
  coordinate: test prefix 좌표
  trace_id: 테스트 실행 세션

→ 기존 이벤트 수집 파이프라인으로 자동 수집
→ convergence pipeline에서 품질 메트릭 집계
```

---

## 4. TestContract — 스펙 문서 ^constraint 연결

### 스펙 문서에서 테스트 케이스 선언

과하게 많은 테스트 케이스를 관리할 때, 스펙 문서에서 ^constraint 마커로
검증 규칙을 선언하고 테스트 케이스와 연결한다.

```markdown
## 호환성 규칙 ^constraint

1. 소비자 필수 필드가 생산자에 없으면 breaking [test:1:3:소비:2]
2. 타입 불일치는 breaking [test:1:3:소비:3]
3. 추가 필드는 상위 호환 [test:1:3:소비:4]
```

### 타입 정의

```typescript
interface TestContract {
  /** 스펙 문서 ID */
  docId: string;

  /** constraint 마커 내 규칙 */
  rules: ContractRule[];
}

interface ContractRule {
  /** 규칙 번호 */
  ruleNumber: number;

  /** 규칙 설명 */
  description: string;

  /** 연결된 테스트 케이스 주소들 */
  testAddresses: string[];

  /** 검증 상태 */
  verified: boolean;
}
```

### 추적 흐름

```
스펙 문서 ^constraint
  → ContractRule (규칙 + 테스트 주소)
    → TestCase (좌표로 식별)
      → TestResult (실행 결과)
        → 규칙별 검증 상태 갱신
```

**규칙에 연결된 테스트가 전부 pass → verified: true**
**하나라도 fail → verified: false → 스펙 문서에 drift 경고**

---

## 5. QualityMetrics — 품질 지표 산출

### 패싯별 메트릭

```typescript
interface FacetQualityMetrics {
  facet: string;
  scope: string;
  aspect: string;

  /** 테스트 수 */
  totalTests: number;

  /** 통과 수 */
  passedTests: number;

  /** 통과율 (%) */
  passRate: number;

  /** 커버리지: 이 패싯에 대한 테스트 존재 여부 */
  hasCoverage: boolean;

  /** constraint 검증율: 연결된 규칙 중 verified 비율 */
  contractVerifiedRate: number;

  /** 마지막 실행 */
  lastExecuted?: string;

  /** drift 여부: 스키마 변경 후 테스트 미실행 */
  hasDrift: boolean;
}
```

### 파이프별 메트릭

```typescript
interface PipeQualityMetrics {
  pipeId: string;

  /** 총 경로 수 (countPipePaths) */
  totalPaths: number;

  /** 테스트된 경로 수 */
  testedPaths: number;

  /** 경로 커버리지 (%) */
  pathCoverage: number;

  /** 패싯별 테스트 분포 */
  facetDistribution: Record<string, number>;

  /** 미커버 패싯 */
  uncoveredFacets: string[];
}
```

### 산출 함수

```typescript
/** 패싯별 품질 지표 계산 */
function computeFacetMetrics(
  suite: TestSuite,
  results: TestResult[],
  contracts: TestContract[],
  latestSchemaVersion?: SchemaVersion,
): FacetQualityMetrics;

/** 파이프별 품질 지표 계산 */
function computePipeMetrics(
  pipeSpec: PipeSpec,
  suites: TestSuite[],
  results: TestResult[],
): PipeQualityMetrics;
```

---

## 6. 검증 루프 (Verification Loop)

```
① 테스트 케이스 정의 (TestCase + 좌표 부여)
  ↓
② 스펙 문서 ^constraint 연결 (TestContract)
  ↓
③ 테스트 실행 (TestResult 이벤트 수집)
  ↓
④ 품질 지표 산출 (QualityMetrics)
  ↓
⑤ drift 감지 (스키마 변경 후 미실행 테스트)
  ↓
⑥ 피드백 → ①로 돌아감 (테스트 추가/수정)
```

### 스키마 변경 시 drift 감지

```
SchemaVersion 변경 감지
  → 이 스키마에 연결된 TestSuite 조회
    → TestSuite의 각 TestCase에 대해
      → 마지막 TestResult가 변경 이전인가?
        → 이전이면: drift = true → 재실행 필요
        → 이후이면: drift = false
```

---

## 7. 주소 체계

### prefix 정의

```
test prefix: scope × aspect × facet × seq

scope: ScopeRegistry에서 관리 (경로 모델)
aspect: scope별 서브셋
facet: 생산 | 소비 | 정의 | 관리 | 저장
seq: 패싯 내 순번 (1-based)
```

### 대량 테스트 관리

테스트 케이스가 많으면 prefix 주소 대신 **문서 ^constraint 연결**을 사용:

```
테스트 수 < 50:  prefix 좌표로 직접 식별
테스트 수 ≥ 50:  스펙 문서 ^constraint로 그룹 관리
                 개별 테스트는 파일 내 이름으로 식별
                 ^constraint에 테스트 파일 + 함수 참조
```

```markdown
## 호환성 검증 ^constraint

검증 파일: `packages/core/src/data-contract.test.ts`

| 규칙 | 테스트 함수 | 상태 |
|------|-----------|------|
| 필수 필드 누락 → breaking | `비호환 — 소비자 필수 필드 누락` | ✓ |
| 타입 불일치 → breaking | `비호환 — 타입 불일치` | ✓ |
| 추가 필드 → 상위 호환 | `상위 호환 — 생산자에 추가 필드` | ✓ |
```

---

## 8. 범위

### 현재 범위

- TestCase 좌표 식별 체계
- TestSuite 패싯 단위 그룹화
- TestResult 이벤트 수집
- TestContract 스펙 ^constraint 연결
- QualityMetrics 패싯/파이프별 품질 지표
- 검증 루프 6단계
- drift 감지

### 후속 구현

| 순서 | 구현 | 파일 |
|------|------|------|
| 1 | TestCase + TestSuite 타입 | `core/src/types/test-tracking.ts` |
| 2 | TestResult 수집기 | `core/src/test-collector.ts` |
| 3 | TestContract 파서 | `definition-catalog/src/test-contract.ts` |
| 4 | QualityMetrics 산출 | `core/src/test-metrics.ts` |
| 5 | drift 감지 | `core/src/test-drift.ts` |
