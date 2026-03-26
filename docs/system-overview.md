---
def:
  id: system-overview
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: deprecated
  tags: [cross-scope, flow, data, interface, state, entry-point]
---
# QA-SDK 시스템 개요

## 목적 ^purpose

이벤트를 좌표로 인코딩하여, 데이터 흐름의 분기점에 명시적 추적성을 부여하는 로깅 SDK + 분석 인프라.

---

## 핵심 개념

### 이벤트

서비스에서 발생하는 모든 행위의 기록. 로그인, 장바구니 담기, API 호출, 배포, 설정 변경 등.

각 이벤트는 `EventRecord`로 표현되며 `event_key`(이름), `payload`(데이터), `address_context`(좌표)를 포함한다.

### 좌표 (Coordinate)

이벤트의 **위치**를 정수 하나로 압축한 것. "어떤 서비스에서, 어떤 환경에서, 어떤 행위가 발생했는가"를 숫자로 표현한다.

```
rbac:v1:0  →  { role: "admin", action: "read", resource: "dashboard" }
```

좌표 시스템의 구성 요소:
- **축 (Axis)**: 유한한 분류 차원. 예: `role`(7개 값), `env`(5개 값), `page`(8개 값)
- **Prefix**: 의미의 재사용 단위. 축의 조합으로 구성된 독립적 주소 공간. 예: `rbac` = role × action × resource
- **prefix_ref**: prefix 간 참조. 다른 prefix의 주소를 값으로 가지는 차원. 디코딩하면 참조된 prefix의 차원들이 펼쳐진다.
  ```
  endpoint:v1:32
    svc_ref: service:65536 (prod/asia/shopping-web/shop)  ← prefix_ref (참조 주소 + 의미)
    resource_type: api                                     ← axis (직접 값)
  ```
- **인코딩**: mixed-radix 방식으로 다차원 좌표를 1D 정수로 변환. prefix_ref 주소는 DB 인덱스 키로 사용 가능

### SDK

서비스에 설치하여 이벤트를 좌표로 인코딩하고 수집 서버로 전송하는 라이브러리.

**Node.js 서버용:**
```typescript
import { createQaContext } from "@qa-sdk/sdk";
const qa = createQaContext({
  serviceConfig: { namespace: "shop", name: "payment", env: "prod", region: "asia" },
  catalog: DEMO_CATALOG,
});
qa.track("order.created", { order_event: { action: "create" } });
```

**브라우저용:**
```typescript
import { createQaMonitor } from "@qa-sdk/browser";
const monitor = createQaMonitor({ ingestUrl: "http://ingest:3200" });
monitor.emitWithCoords("page.home", {
  tracking: { trackAction: "view", page: "home", userType: "guest" },
});
```

### Catalog

축과 prefix의 정의. 시스템의 **유일한 입력** — 나머지는 전부 카탈로그에서 파생된다.

```typescript
DEMO_CATALOG = {
  axes: { role: { entries: ["admin","developer",...], capacity: 32 }, ... },
  prefixes: { rbac: { dims: { role, action, resource }, ... }, ... },
  tables: { members: { columns: { role: { kind: "axis_ref", axisId: "role" } } }, ... },
}
```

현재: 85축, 51 prefix, 19 tables. DKG: 16종 노드 (FlowSchemaNode 포함).

### Axis 소비 방식

Axis = 비즈니스 정보의 유한 분류. **소비 방식은 소비자가 결정한다.**

- **좌표 소비**: Axis × Axis → 1D 주소 (prefix dims)
- **필터 소비 (태깅)**: 대상에 축 값을 1:N 다중 부여 (concerns, structural, def.tags)
- **권한 소비**: PolicyRule.match 조건
- **게이트 소비**: entry별 active/inactive 판정
- **의사결정 소비**: FlowSchema의 Gate=Axis, Branch=Entry
- **전파 소비**: ConcernTag가 depends_on 링크를 타고 하위 상속

태깅 관리: 대상이 사는 곳에 함께 저장. 카디널리티는 축별 (단일/다중). 상세: `docs/specs/system/tag-management.spec.md`

---

## 데이터 흐름

```
SDK (브라우저/서버)
  │ encode → address_context: { "tracking": "tracking:v2:42" }
  ▼
ingest-server (:3200)
  │ Phase 1: 수신 + 저장
  │ Phase 2: 재구성 + 판정 (Verdict)
  │ Phase 2.5: 전이 해석 (TransitionSpec)
  │ Phase 3: convergence 분석
  ▼
DKG Store (SQLite)
  │ usage snapshots, metrics, observations
  ▼
CLI (qa-sdk dkg ...)
  │ self-check, converge, discover-links, trace, impact
  ▼
인간 판단
  │ observe → decide → resolve (관측 루프)

────────────────────── 의사결정 플로우 ──────────────────────

dkg decide --type <t>
  │ → FlowEngine (coordinate-design 플로우 자동 시작)
  │ → gate 순회: 코어 gate 경고, evidence 자동 수집
  │ → FlowInstance 완료: address_context 자동 생성
  ▼
DecisionNode ← justifies → FlowSchemaNode (DKG 16종째)
  │ flowInstanceId 양방향 참조
  ▼
InstanceStore (이력 저장)
  │
  ├── PatternDetector → PolicyCandidate → 인간 승인 → FlowPolicy
  └── Comparison (쌍 비교 / gate 분포 / 시간 범위) → ComparisonReport
```

---

## 분석 시스템

### Self-Check (5 phases)

시스템 건강 진단. `qa-sdk dkg self-check [--fast] [--apply]`

| Phase | 검사 | 소요 시간 |
|-------|------|----------|
| A | 빌드 + 테스트 (26 패키지) | ~5분 (--fast로 스킵) |
| B | entry 커버리지 (현재 100%) | <1초 |
| D | DSL 불변조건 | <1초 |
| E | IntentLink flow-trace | <1초 |
| CLI | CLI 좌표 관측 커버리지 | <1초 |

### Convergence

축/prefix 중복·낭비 분석. `qa-sdk dkg converge [--persist]`

- **merge**: 축 간 Jaccard 유사도 → 병합 후보 (DEC-SEP로 이미 결정된 건 자동 억제)
- **deactivate**: 장기 미사용 entry
- **simplify**: 단일값 차원
- **observe**: 배포 스큐, 인과 발견

### IntentLink

**"이 prefix들은 같은 맥락에서 함께 관측되어야 한다"**는 설계 의도의 명시적 선언.

```
IL-checkout-flow:
  endpoints: [page_view, endpoint, flow_point, order_event, permission]
  via: service
  invariant: "checkout page_view 없이 checkout flow_point(success)가 관측되면 안 됨"
```

현재 15개 IntentLink:
- IL-checkout-flow (결제 흐름)
- IL-api-event (API ↔ 이벤트)
- IL-infra-impact (인프라 변경 → API 영향)
- IL-pattern-observation (패턴 ↔ 흐름 관측)
- IL-cart-abandon (장바구니 ↔ 주문)
- IL-pipeline-flow (파이프라인 단계)
- IL-dkg-operation (DKG 운영 순차 추적)
- IL-build-test (빌드→테스트→계약 검증)
- IL-auth-permission (인증 ↔ 권한)
- IL-content-track (콘텐츠 ↔ 추적)
- IL-schema-engine (스키마 변경 → 엔진 평가)
- IL-skill-cli (CLI 스킬 실행 추적)
- IL-version-rollout (버전 롤아웃 추적)
- IL-test-matrix (테스트 매트릭스)
- IL-resource-track (리소스 추적)

**위반 감지**: self-check Phase E에서 `traceFlows()`가 실 트래픽의 IntentLink invariant 위반을 자동 감지.

### Co-occurrence

이벤트에서 **여러 prefix가 동시에 관측**되는 패턴. IntentLink의 자동 발견 경로.

```
co-occurrence 분석 → prefix 쌍의 동시 관측 비율
  rate ≥ 95%, count ≥ 1000 → IntentLink 후보 (high)
  rate ≥ 80%, count ≥ 500  → constraint 후보 (medium)
  rate ≥ 50%, count ≥ 100  → 추가 관찰 (low)
```

CLI: `qa-sdk dkg discover-links`

### TransitionSpec

이벤트 시퀀스에 **상태 전이 의미**를 부여. "무엇이 발생했는가"에서 "무엇이 되었는가"로 확장.

```
user.login TransitionSpec:
  match: endpoint(POST,api) → auth_event(login) → flow_point(login,success)
  effect: open
  output: lifecycle_state = "active"
```

현재 19개 TransitionSpec (`spec-core/transition/demo-transition-specs.ts`).

---

## DKG (Design Knowledge Graph)

좌표 시스템의 **"왜"**를 보존하는 설계 시점 그래프.

### 노드 16종

| 계층 | 노드 |
|------|------|
| 구조 | Axis, Prefix, Table |
| 설계 | Decision, Constraint, VersionEvent, Observation |
| 조직 | Domain, Consumer, IntentLink, DslBundle, Skill |
| 확장 | TransitionSpec |
| 의사결정 | FlowSchema |

### 관측 루프

```
감지 → observation 생성 (루프 열림)
  → decision 기록 (판단)
  → resolve (루프 닫힘)
```

- monitoring intent: 닫지 않아도 됨. 30일 이상 변화 없으면 자동 만료
- action-needed intent: 반드시 닫아야 함

### GraphPort 3단 추상화

| 레벨 | 소비자 | 반환 타입 |
|------|--------|----------|
| GraphPort | convergence/schema | `{ kind, id }` |
| GraphRegistryPort | 서비스 동적 import | 최소 2메서드 |
| GraphRegistry | CLI/skills | DkgNode 16종 구체 타입 |

---

## 패키지 구조

```
수학/인코딩 ────── weighted-index → bit-index → permission-engine
Core ──────────── @qa-sdk/core (타입, catalog runtime)
SDK 레이어 ────── logger → codec → context → sdk → apm
Browser ────────── browser-codec (encode/decode SSOT) → browser-sdk (범용 SDK — 도메인 데이터 없음)
의사결정 ────────── decision-flow (분기 엔진, 패턴 학습, 경로 비교)
분석 ──────────── convergence (독립) → spec-core (DKG + skills + FlowSchemaNode)
서비스 ──────────── ingest, registry-server, registry-service, gate, query, decode
데모/참조 ────────── demo-snapshot, demo-types, shop-web, viz-3d
```

---

## CLI 사용 가이드

```bash
# 일상 운영
qa-sdk dkg self-check --fast       # 0.3초 건강 진단
qa-sdk dkg converge --persist      # 수렴 분석 + 저장
qa-sdk dkg report                  # 현황 요약

# 조회
qa-sdk dkg trace <id>              # 노드 추적 (구성/소속/제약/cascade)
qa-sdk dkg impact <axis>           # 축 변경 영향 분석
qa-sdk dkg table <table>           # DB 테이블 의존 추적
qa-sdk dkg service <id>            # 서비스 프로파일
qa-sdk dkg prefix <id>             # prefix 상세

# 발견
qa-sdk dkg discover-links          # co-occurrence → IntentLink 후보
qa-sdk dkg overlaps                # 축 중복 감지
qa-sdk dkg promote                 # 좌표 승격 후보 (5Q)
qa-sdk dkg scan-tables             # DB 스키마 drift 감지

# 변경
qa-sdk dkg add-entry <axis> <entry>    # 축 entry 추가
qa-sdk dkg observe --target <id>       # 관측 기록
qa-sdk dkg decide --type <t>           # 의사결정 기록 (→ flow 자동 실행)
qa-sdk dkg decide --legacy             # 기존 방식 (flow 없이 직접 DecisionNode)
qa-sdk dkg resolve <obs>               # 관측 루프 닫기

# 의사결정 플로우
qa-sdk flow list                       # FlowSchema 목록
qa-sdk flow start <id>                 # 플로우 시작
qa-sdk flow select <branch>            # 분기 선택
qa-sdk flow status                     # 인스턴스 상태
qa-sdk flow trace <id>                 # 코어 결정 추적
qa-sdk flow analyze <id>               # 구조적 분석
qa-sdk flow policy learn <schema>      # 패턴 감지 → 정책 후보 생성
qa-sdk flow policy candidates          # 후보 목록
qa-sdk flow policy approve/reject <id> # 후보 승인/거부
qa-sdk flow compare <a> <b>            # 인스턴스 쌍 비교
qa-sdk flow lookup <keyword>           # 키워드로 의사결정 이력 조회
qa-sdk flow history [schema-id]        # 완료된 인스턴스 이력
qa-sdk flow verdict <instance-id>      # 판정 상태 + 성공 기준

# DKG FlowSchema 조회
qa-sdk dkg flow-schemas                # FlowSchemaNode 목록
qa-sdk dkg flow-schema <id>            # 개별 프로파일
qa-sdk dkg diagram flow-schema <id>    # Mermaid 다이어그램

# 인코딩
qa-sdk encode <prefix> --dim val       # 좌표 인코딩
qa-sdk decode <prefix:ver:addr>        # 좌표 디코딩
```

---

## 커버리지

### Entry 커버리지

`generateSyntheticEvents(catalog)`가 카탈로그에서 합성 이벤트를 **자동 생성**. 각 axis의 모든 entry를 최소 1회 인코딩.

- 알고리즘: 합(sum) 전략 — Σ(entries) 이벤트 (곱이 아닌 합)
- 측정 단위: axis entry (조합이 아님)
- 새 축/entry 추가 시 수동 갱신 불필요

### CLI 커버리지

모든 CLI 명령이 `emitCliEvent()` → `cli_event` prefix로 자동 기록. `analyzeCliCoverage()`로 dormant 좌표(한 번도 실행 안 된 기능) 감지.

---

## 실 트래픽 검증 (2026-03-23 달성)

```
shop-web → ingest-server
  ├── convergence pipeline: 115 metrics, 49 observations, DKG 저장 ✅
  ├── IntentLink flow violations: 4종 자동 감지 ✅
  ├── co-occurrence: 20 쌍, 기존 IL 100% 매칭 ✅
  └── TransitionSpec: user.login 3-event ordered 매칭 ✅
```
