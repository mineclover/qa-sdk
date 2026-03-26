---
def:
  id: spec-next-phase
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [structural, tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
---

# Next Phase — Skills + 인프라 + 수집 테스트

## 목적 ^purpose

prefix의 3가지 사용 모드를 인프라로 연결하고,
skills/문서 자체도 prefix 기반으로 관리하며,
이벤트 수집이 실제로 동작하는지 검증한다.

## 구성 ^overview

- `prefix의 3가지 사용 모드`: prefix를 enum 공유, 이벤트 로깅, 권한 bitmask라는 세 가지 런타임 진입점으로 묶어 설명한다.
- `skills/문서를 prefix로 관리`: skill과 문서 메타데이터를 prefix 주소로 승격해 DKG와 propagation에 연결하는 방향을 정리한다.
- `환경 주입 — 3단계 PartialBinder`: 빌드, 배포, 런타임 단계별로 환경 차원을 주입하는 QaContext 연동 모델을 설명한다.
- `이벤트 수집 인프라 — E2E 검증 필요`: SDK에서 ingest와 UsageData, convergence까지 이어지는 종단 수집 체인을 검증 대상으로 묶는다.
- `구현 우선순위`: Phase A-D 순서로 수집, 권한, skill/doc prefix화, codegen 자동화 로드맵을 고정한다.
- `3가지 사용 모드 × 진입점 매핑`: CLI, SDK, Server, DKG가 어떤 prefix 사용 모드를 담당하는지 한 표로 정리한다.

---

## prefix의 3가지 사용 모드

### 모드 1: enum/타입 공유

prefix가 시스템 전역의 공유 어휘 역할.

```
axis entries = 시스템의 공식 enum
prefix = enum들의 교차 (의사결정 단위)
codegen = prefix에서 TS/Proto/JSON Schema 자동 생성 → 서비스간 타입 동기화

현재 있는 것:
  ✅ DEMO_CATALOG (SSOT)
  ✅ codegen (IR → TS/JS/Proto/JSON Schema)
  ✅ CLI: qa encode/decode

필요한 것:
  · codegen을 registry-service activate 시 자동 트리거
  · 생성된 타입을 npm 패키지 또는 git artifact로 배포
  · 서비스가 import하여 타입 안전하게 사용
```

### 모드 2: 이벤트 로깅/추적

prefix가 이벤트의 식별자. address_context로 태깅.

```
EventRecord.address_context: { "permission": "permission:v4:65536", "api": "api:v1:2177" }
→ ingest-server가 수집
→ address_context를 집계하면 UsageData가 됨
→ 수렴 레이어가 UsageData를 소비하여 수렴 기회 발견

현재 있는 것:
  ✅ EventRecord.address_context 필드 (core 타입)
  ✅ ingest-server POST /v1/ingest
  ✅ QaLogger, HttpTransport (SDK 수집)
  ✅ 수렴 레이어 (UsageData → 분석)

필요한 것:
  · SDK에서 encode 결과를 address_context에 자동 태깅
  · ingest-server에서 address_context를 집계하는 비동기 worker
  · 집계 결과 → UsageData → 수렴 레이어 피드
  · E2E 테스트: SDK encode → ingest → 집계 → 수렴 분석
```

### 모드 3: 권한/필터/스코프

prefix가 bitmask의 position. O(1) 권한 체크.

```
encode("permission", { role: "admin", action: "write" }) → 정수 42
hasBit(userMask, 42) → true/false  (O(1))

BitIndex.extractDim(packed, dimIndex)  ← O(1) 단일 축 추출
BitMaskSet.filterByLabels({ role: 2 }) ← 다축 AND 필터
ScopedEngine.scope("prod:asia").grant(42) ← 스코프별 독립 마스크

현재 있는 것:
  ✅ weighted-index (encode/decode)
  ✅ bit-index (BitIndex, BitMaskSet)
  ✅ permission-engine (ScopedEngine, TernaryMask, PermissionCodec)
  ✅ PartialBinder (빌드/배포/런타임 3단계)

필요한 것:
  · QaContext에서 bitmask 연산 통합
  · qa.can("permission", { role: "admin", action: "write" }) → boolean
  · ScopedEngine과 QaContext 연결 (환경 주입 → 스코프 자동 선택)
```

---

## skills/문서를 prefix로 관리

### 현재

skills는 TypeScript 함수. 문서는 markdown. prefix와 분리되어 있다.

### 목표

```
skill_def prefix: skill_name × skill_category × skill_version
→ "어떤 skill이 어떤 카테고리에서 어떤 버전으로 등록되어 있는가"

doc_ref prefix: doc_type × doc_subject × doc_version
→ "어떤 문서가 어떤 대상에 대해 어떤 버전으로 존재하는가"

이렇게 하면:
  · skill 자체가 prefix 주소를 가짐 → DKG에서 추적 가능
  · 문서 자체가 prefix 주소를 가짐 → 문서 간 관계를 좌표로 추적
  · skill이 생성/업데이트되면 → prefix version bump → propagation
```

### 축 정의 후보

```
skill_name:     ["impact-analysis", "infer-migrator", "scaffold-decision", "derive-refs", ...]
skill_category: ["analysis", "migration", "generation", "validation"]
doc_type:       ["spec", "adr", "guide", "cookbook", "api-ref"]
doc_subject:    ["weighted-index", "dkg", "propagation", "convergence", "sdk"]
```

---

## 환경 주입 — 3단계 PartialBinder

이미 구현된 PartialBinder를 QaContext와 연결:

```
Stage 1 (빌드): namespace, service name 고정
Stage 2 (배포): env, region 주입 (K8s env var)
Stage 3 (런타임): role, action, resource 결정 (HTTP 요청)

QaContext가 Stage 1+2를 캐시하고, Stage 3만 개발자가 다룬다.
이것이 "환경 값 끼워넣기"의 구현.
```

```typescript
// 현재 QaContext의 encode:
qa.encode("permission", { role: "admin" })
// 내부: { env: "prod", region: "asia", service: "payment", ..., role: "admin" }

// PartialBinder 연동 후:
// Stage 1+2 base가 캐시됨 → Stage 3 delta만 계산
// 성능: O(free dims) 만큼만 연산
```

---

## 이벤트 수집 인프라 — E2E 검증 필요

```
SDK → encode → address_context 태깅 → HttpTransport → ingest-server
                                                          │
                                                          ▼
                                                    address_context 집계
                                                          │
                                                          ▼
                                                    UsageData 생성
                                                          │
                                                          ▼
                                                    수렴 레이어 분석
                                                          │
                                                          ▼
                                                    Observation → DKG

필요한 구현:
  1. SDK: qa.track() 시 address_context 자동 태깅
  2. ingest-server: address_context 집계 worker
  3. 집계 → UsageData 변환
  4. UsageData → discoverCausality, analyzeSimplification 등 실행
  5. E2E 테스트: 전체 파이프라인 통과 검증
```

---

## 구현 우선순위

### Phase A: 이벤트 수집 E2E (모드 2 검증)

```
A-1. SDK qa.track()에 address_context 자동 태깅
A-2. ingest-server에 address_context 집계 로직
A-3. 집계 → UsageData 변환
A-4. E2E 테스트: encode → track → ingest → aggregate → converge
```

### Phase B: 권한/필터 통합 (모드 3 연결)

```
B-1. QaContext에 bitmask 연산 통합 (qa.can())
B-2. ScopedEngine + QaContext 환경 연결
B-3. PartialBinder 3단계 + QaContext 캐시
B-4. E2E 테스트: encode → bitmask → can() → scope filter
```

### Phase C: skills/문서 prefix화

```
C-1. skill_def, doc_ref 축/prefix 정의
C-2. skill 등록/조회를 prefix 기반으로
C-3. 문서 메타데이터를 prefix 주소로 태깅
C-4. DKG에 skill/doc 노드 연결
```

### Phase D: codegen + 배포 자동화 (모드 1 완성)

```
D-1. registry-service activate → codegen 자동 트리거
D-2. 생성된 타입 패키지 자동 publish
D-3. 서비스별 타입 동기화 검증
```

---

## 3가지 사용 모드 × 진입점 매핑

| 진입점 | 모드 1 (enum) | 모드 2 (로깅) | 모드 3 (권한) |
|---|---|---|---|
| **CLI** | `qa encode/decode/codegen` | `qa track` (미래) | `qa check-perm` (미래) |
| **SDK** | `qa.encode()` | `qa.track()` → address_context | `qa.can()` → bitmask |
| **Server** | registry-service | ingest-server | permission-engine |
| **DKG** | prefix/axis 관리 | UsageData → 수렴 | 권한 정책 추적 |

각 진입점이 prefix를 통해 같은 좌표 체계를 공유한다. 정수는 내부에서만 돌고, 개발자는 문자열만 다룬다.
