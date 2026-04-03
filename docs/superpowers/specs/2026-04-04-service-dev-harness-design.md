# 서비스 개발 하네스 — 설계 문서

**날짜:** 2026-04-04
**상태:** 승인됨

---

## 목적

테스트 환경, 관측성, 순차적 개발 지원, 추상화/시각화, 개발 방법론 강제를 하나의 통합 DX 레이어로 제공하는 서비스 개발 하네스.

분산된 인프라(definition-harness, meta-semantic-system, ingest 파이프라인)를 단일 워크플로우로 묶는다.

---

## 섹션 1 — 전체 구조

### 흐름

```
스펙 문서 (frontmatter tests: 선언)
    │
    │  qa-sdk test scan
    ▼
A 좌표: def:{spec_address}/{test_kind}    ← 파생, 미할당 상태
    │
    │  qa-sdk test assign
    ▼
B 좌표: test_scenario:v1:M              ← 독립, 기준점 (B가 A를 가리킴)
    │
    ├── 테스트 스텁 생성 (qa-sdk test scaffold)
    ├── 실행 수집 → ingest 파이프라인
    ├── 버전 관리 (스펙 lifecycle 연동)
    └── 시각화 피드백 (커버리지 매트릭스)
```

### 핵심 패키지

| 패키지 | 역할 |
|--------|------|
| `test-scenario-store` | B 좌표 SQLite 레지스트리 + drizzle |
| `@qa-sdk/test-harness` | TestScenario 타입 + lifecycle FSM |
| CLI 명령군 (`qa-sdk test *`) | scan/assign/scaffold/simulate/run/status/report |

### 기존 시스템과의 관계

| 기존 | 역할 |
|------|------|
| `def_document:v2:N` | A 좌표의 부모 (스펙 address) |
| `harness-tracker` | 테스트 실행 이벤트 수집 재사용 |
| `definition-service` | 스펙 lifecycle/version 조회 |
| `pipe-simulate` | 시뮬레이션 실행 엔진 |
| `ingest-server` | 실행 결과 EventRecord 수집 |

### B 좌표 구조

```
test_scenario:v1:M

axes:
  test_kind   (capacity 16)  — 테스트 유형, append-only
  test_scope  (capacity 8)   — 서비스 범위, append-only
  spec_path   (sum model)    — 스펙 경로 합산 (leaf path당 1 segment)

metadata:
  primary_svc: svc_ref        — 진입점 서비스 (모듈 import 경로)
  participants: svc_ref[]     — 교차 서비스 목록 (cross-scope일 때)
  simulation_ref?: address    — 연결된 PipeSpec 주소 (simulation 타입일 때)
  spec_version: string        — 스펙 lifecycle 버전
  code_commit: string         — 실행 시점 커밋 해시
```

**spec_path 합산 모델:**

```
전곱 (금지):
  spec_level1(1024) × spec_level2(1024) = 1,048,576  ← 도달 불가 조합 낭비

합산 (적용):
  path₀: group-A > module-X > leaf-1  → [0..K₀]
  path₁: group-A > module-X > leaf-2  → [K₀..K₁]
  → 실제 존재하는 스펙 경로만큼만 주소 공간 사용
  → 스펙 추가 시 segment append-only, 기존 주소 불변
```

**cross-service 서비스 조합 인코딩 원칙:**

서비스 조합은 분류가 아니라 관계이므로 좌표에 인코딩하지 않는다. `participants[]` 메타데이터로 추적하고 메타 인덱스로 쿼리한다.

```
"auth-service가 관련된 cross-service 테스트 전체"
→ participants contains auth-service (메타 필터)

"e2e + multi scope 전체"
→ test_kind=e2e × test_scope=multi (주소 range query)
```

---

## 섹션 2 — 생명주기 + 컨벤션 게이트

### 5단계 생명주기

```
declared → [modularity-gate] → assigned → collected → verified
```

| 단계 | 조건 | CLI |
|------|------|-----|
| `declared` | 스펙 frontmatter `tests:` 선언됨 | `qa-sdk test scan` |
| `assigned` | 모듈화 게이트 통과 + B 좌표 부여 | `qa-sdk test assign` |
| `collected` | 실행 결과 1건 이상 ingest | 테스트 러너 자동 |
| `verified` | pass rate 기준 충족 | `qa-sdk test status` |
| `archived` | 연결된 스펙 deprecated | 자동 cascade |

### 모듈화 게이트 (advisory)

`declared → assigned` 진입 시 체크. 실패는 경고 + `convention_violation` 마킹이며 차단은 선택적.

```
체크 1: import 경로 존재 여부
  → 선언된 모듈이 named export로 독립 접근 가능한가

체크 2: 패싯 혼합 감지 (advisory)
  → produce/consume/store 역할이 혼합된 모듈인가
  → 실패 시 경고: "패싯 혼합 감지 — 분리 권장"
  → 역할 혼합 자체는 허용, 명시적 인지 후 진행 가능

체크 3: 주입 가능성
  → 외부 의존이 constructor/parameter injection 형태인가
```

**실패 출력 예:**

```
$ qa-sdk test assign auth-service

⚠ modularity-gate advisory
  - [패싯혼합] processAuth(): produce + store 역할 혼합 감지
    → packages/auth-service/src/auth.ts:42
    → 권장: saveToken()을 별도 모듈로 분리

convention_violation 마킹됨. --force로 강제 진행 가능.
```

### 패싯 분리 → 테스트 타입 매핑

테스트할 수 없는 코드 = 모듈화 안 됨 = 패싯 분리 위반. 패싯 역할이 테스트 타입을 자연스럽게 결정한다.

```
DataFacet 역할           → 모듈 경계      → 테스트 타입
─────────────────────────────────────────────────────
produced (생산)          → 변환 모듈      → unit
consumed (소비)          → 조회 모듈      → data-exchange
defined  (정의)          → 스키마 모듈    → unit
managed  (관리)          → 상태 모듈      → db-transaction
stored   (저장)          → repo 모듈      → db-transaction
produced + UI 렌더       → 컴포넌트       → ui-logic / e2e
```

---

## 섹션 3 — 테스트 타입 + 시뮬레이션 연결

### 테스트 타입 taxonomy

두 축 모두 append-only. 초기값은 최소 필요 집합이며 비즈니스 요구에 따라 확장한다.

```
test_kind (capacity 16, 현재 8종):

  단일 관심사 (test_scope=single 기본):
    unit          — 순수 함수 단위 검증
    ui-logic      — UI 컴포넌트 로직
    ui            — UI 렌더링/인터랙션
    db-transaction — DB 트랜잭션 원자성

  교차 관심사:
    data-exchange  — 서비스 간 데이터 계약
    auth-flow      — 권한 흐름

  복합:
    e2e            — UI→서비스→DB 전체 경로
    simulation     — PipeFlow 시뮬 vs 실제 비교

  ...              — append-only 확장 가능

test_scope (capacity 8, 현재 4종):
  single   — 단일 서비스
  pair     — 2개 서비스
  multi    — 3개 이상
  system   — 전체 시스템
  ...      — append-only 확장 가능
```

### 시뮬레이션 연결 구조

```
PipeSpec (설계 의도)
    ↓ pipe-simulate
SimulationResult (기대 실행 경로 + 기대 이벤트)
    ↓ matchHappyPath()
    │
    └── TestScenario (kind=simulation)
          import { actualModule } from '...'
          실제 코드 실행 → 실제 경로 수집
              ↓
          compareWithSimulation()
              ↓
          drift 없음 → verified
          drift 감지 → 스펙 or 코드 보정 피드백
```

**시나리오 증명 흐름:**

```
qa-sdk test simulate auth-flow
  1. PipeSpec 로드 → pipe-simulate 실행
  2. SimulationResult 생성 (기대 경로 N개)
  3. 각 기대 경로 → TestScenario(kind=simulation) B 좌표 할당
  4. 실제 모듈 import → 경로별 실행
  5. compareWithSimulation() → drift 리포트
  6. ingest 수집 → 시각화 피드백
```

**drift의 의미:**

```
시뮬 기대 경로 ≠ 실제 경로
  → "설계가 틀렸거나 구현이 틀렸거나"
  → 둘 중 하나를 명시적으로 보정해야 verified 도달
```

---

## 섹션 4 — 수집 + 버전 관리 + 시각화

### 수집 경로

```
테스트 실행
    ↓
harness-tracker (기존 재사용)
    ↓  test_scenario:v1:M 좌표로 emit
ingest-server → EventRecord
    ↓
test-scenario-store (SQLite)
    ↓
시각화 레이어
```

### 버전 관리

스펙 lifecycle 변경이 TestScenario 상태에 cascade된다.

```
스펙 draft      → scenario declared (자동)
스펙 approved   → assign 가능 상태
스펙 deprecated → scenario archived (cascade)

실행 이력:
  spec_version + code_commit_hash → run record
  → "스펙 v2, 커밋 abc123에서 통과" 이력 보존
```

### 시각화 — 커버리지 매트릭스

```
          unit  ui-logic  db-tx  auth-flow  simulation  e2e
auth-svc   ✅     -        ✅      ✅          ✅         -
payment    ✅     -        ✅      -           🔄         -
shop-web   -      ✅       -       -           -          ✅
auth×pay   -      -        -       ✅          -          -
           ↑ single scope          ↑ pair scope

✅ verified  🔄 collected  ○ assigned  · declared  ✗ violation
```

### 피드백 루프

```
시각화 대시보드
  → "payment simulation drift 감지됨"
  → 클릭 → drift 상세 (기대 경로 vs 실제 경로)
  → 링크 → 스펙 문서 / 코드 위치
  → 다음 액션 제안: "PipeSpec 수정 or 구현 수정"
```

### CLI 커맨드 전체

```
qa-sdk test scan       — 스펙 선언 읽기 → declared
qa-sdk test assign     — 모듈화 체크 → B 좌표 부여
qa-sdk test scaffold   — 테스트 스텁 파일 생성
qa-sdk test simulate   — 시뮬 vs 실제 비교
qa-sdk test run [kind] — 특정 타입 실행 + 수집
qa-sdk test status     — 생명주기 현황
qa-sdk test report     — 커버리지 매트릭스 출력
```

---

## 설계 원칙 요약

1. **spec-first → scaffold**: 스펙 선언이 모든 것의 시작점
2. **A 좌표 → B 좌표 승격**: 미할당(파생) → 할당(기준점), B가 canonical reference
3. **서비스 조합은 메타데이터**: 조합 폭발 방지, participants[] 로 추적
4. **spec_path 합산**: 전곱 금지, 실제 경로만 주소화
5. **모듈화 = 테스트 가능성**: 테스트 불가 코드 = 컨벤션 advisory
6. **패싯 분리 → 테스트 타입**: 역할이 테스트 전략을 결정
7. **시뮬 = 설계 증명**: drift 감지로 설계-구현 정합성 유지
8. **두 축 모두 append-only**: test_kind, test_scope 확장 가능
