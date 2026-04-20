---
def:
  tier: component
  id: version-operations
  address: def_document:v2:137372
  scope: flow
  aspect: process_flow
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, versioning, structural]
  links:
    - target: coord-foundation
      type: depends_on
---

# 버전 운영 — Draft Cycle, 배포, 다중 버전 관리

## 목적 ^purpose

버전의 수학적 원리(stride, capacity, headroom)는 [`foundation.md`](foundation.md) §2–§3을 참조한다.
이 문서는 **대규모 분산 시스템에서 버전을 운영하는 방법**을 다룬다.

## 구성 ^overview

- **2-Phase 운영 모델**: 평시(Phase 1, headroom 내 append)와 Draft Cycle(Phase 2, capacity 조정 + 마이그레이션)을 반복하는 버전 관리 체계를 정의한다.
- **DraftWorkspace**: 중앙 PrefixRegistry 위에 draft 버전의 파급 효과를 DAG 순회로 계산하며, Impact Graph·Capacity Simulation·Readiness Gate·Release Coordinator를 포함한다.
- **Capacity Simulation**: draft capacity 조합으로 전체 stride/product를 재계산하고, Number/BigInt 경계 판단과 주소 공간 크기를 예측한다.
- **Diagnostics 체계**: error(Number overflow, 순환 참조), warn(BigInt 임계점, stride 변경), info(stride 불변) 등 draft 단계에서 문제를 사전 식별한다.
- **배포 워크플로**: Draft Lock → Readiness Gate → Release(위상정렬 순서)의 3단계로 진행하며, 버전 결정은 런타임이 아닌 배포 시점에 확정한다.
- **배포 시점 버전 결정**: 프론트엔드는 빌드 타임, 백엔드는 배포 타임에 버전을 고정하여 런타임 레지스트리 의존성을 제거한다.
- **저장값 마이그레이션**: 서비스 간 통신은 송신 시 변환으로 즉시 해결하고, 자체 DB 마이그레이션은 read-repair 또는 배치로 독립 진행한다.

---

## 1. 2-Phase 운영 모델

시스템은 평시와 Draft Cycle 두 단계를 반복한다.

```
Phase 1: 평시 (headroom 내)
  → 참조 주소 기반 동작
  → entries append만 발생
  → stride 불변, 마이그레이션 없음
  → 단일 축은 실제 식별값까지 안정적

Phase 2: Draft Cycle (headroom 소진 또는 구조 변경)
  → 관련 축들을 draft로 전환
  → capacity 조정, entries 재구성
  → release 시 stride 확정 + migration mapping 계산
  → activate 후 read-repair로 점진 마이그레이션
```

대부분의 스키마 진화는 Phase 1에서 처리된다. Draft Cycle은 headroom 소진 또는 차원 추가/제거 같은 구조 변경 시에만 발생한다.

---

## 2. Draft Workspace — 대규모 시스템의 Draft 정합성

### 2.1 전제: 중앙 레지스트리

모든 prefix와 주소를 다루는 **중앙 PrefixRegistry**가 전체 DAG를 소유한다. 각 서비스가 어떤 prefix를 소유하든, 참조 관계와 capacity 정보는 중앙에 등록된다. capacity만 알면 stride와 product를 결정론적으로 계산할 수 있으므로, **파급 효과 계산은 중앙에서 한번에 수행할 수 있다.**

### 2.2 DraftWorkspace의 역할

```
Central Registry
  │
  ├── PrefixRegistry: 확정된 버전의 refs/capacity/shape
  │
  └── DraftWorkspace: draft 버전의 파급 효과 계산
       │
       ├── Impact Graph
       │     leaf capacity 변경 → DAG 순회 → 영향받는 prefix 전부 식별
       │     서비스 경계를 넘어 소유자별 영향 범위 매핑
       │
       ├── Capacity Simulation
       │     draft capacity 조합으로 전체 stride/product 재계산
       │     Number/BigInt 경계 판단, 주소 공간 크기 예측
       │
       ├── Readiness Gate
       │     모든 draft의 정합성 검증 → "release 시작 가능" 판정
       │     위상정렬로 release 순서 제시
       │
       └── Release Coordinator
             leaf부터 순서대로 release
             각 단계에서 migration mapping 계산
             composite는 참조 leaf가 확정된 후에만 release 가능
```

### 2.3 Capacity Simulation

멀티 서비스 환경에서의 시뮬레이션 예시:

```
서비스 A 소유: role(draft, cap=100), action(draft, cap=15)
서비스 B 소유: resource(active, cap=50)
서비스 C 소유: perm(draft, refs=[role, action]), access_log(draft, refs=[perm, resource])
```

서비스 A가 `role` capacity를 100→200으로 변경하면:

```
DraftWorkspace.simulate({ role: { capacity: 200 } })
→ {
    impact: [
      { prefix: "perm",       owner: "C", shape: [200,15],    product: 3_000 },
      { prefix: "access_log", owner: "C", shape: [3000,50],   product: 150_000 },
    ],
    numberType: "number",
    ready: true,
    releaseOrder: ["role", "action", "perm", "access_log"],
    diagnostics: [],   // 문제 없음
  }
```

서비스 A가 극단적으로 `role` capacity를 1,000,000으로 요청하면:

```
DraftWorkspace.simulate({ role: { capacity: 1_000_000 } })
→ {
    impact: [
      { prefix: "perm",       product: 15_000_000 },
      { prefix: "access_log", product: 750_000_000 },
    ],
    numberType: "number",
    ready: true,
    diagnostics: [
      { level: "warn", prefix: "access_log", owner: "C",
        message: "product 750M — BigInt 전환 임계점 접근 (2^53 대비 0.008%)" },
    ],
  }
```

실제 문제가 발생하는 경우:

```
DraftWorkspace.simulate({ role: { capacity: 10_000_000 } })
→ {
    impact: [
      { prefix: "perm",       product: 150_000_000 },
      { prefix: "access_log", product: 7_500_000_000 },
      { prefix: "audit_trail", product: 7.5e15 },
    ],
    ready: false,
    diagnostics: [
      { level: "error", prefix: "audit_trail", owner: "D",
        message: "product 7.5e15 — Number 한계(2^53) 초과. encode/decode 결과가 틀려짐. 즉시 BigInt 전환 필수" },
      { level: "error", prefix: "audit_trail", owner: "D",
        message: "현재 numberType:'number' — 이 상태로 release하면 데이터 손상. BigInt 전환 없이 진행 불가" },
      { level: "warn", prefix: "access_log", owner: "C",
        message: "product 7.5B — 주소 공간 과대. capacity 재검토 권장" },
      { level: "info", prefix: "perm", owner: "C",
        message: "stride 변경: [15,1]→[15,1] (불변). 마이그레이션 불필요" },
    ],
  }
```

### 2.4 Diagnostics 유형

| level | 유형 | 설명 |
|-------|------|------|
| **error** | Number overflow | product가 2^53 초과 — encode/decode가 틀린 값을 반환. 데이터 손상 |
| **error** | numberType 불일치 | composite가 `number`인데 leaf 변경으로 BigInt 필요 |
| **error** | 순환 참조 | draft DAG에 cycle 발생 |
| **warn** | BigInt 임계점 접근 | product가 2^53의 일정 비율 이상 |
| **warn** | 과대 주소 공간 | capacity 대비 실제 entries가 극소 — 낭비 |
| **warn** | stride 변경 | composite의 기존 주소가 무효화됨 — 마이그레이션 필요 |
| **info** | stride 불변 | 영향은 있지만 마이그레이션 불필요 |
| **info** | 영향 없음 | DAG에 포함되지만 shape 변동 없음 |

### 2.5 실용 지침: 초기 capacity를 넉넉하게

실제로 대부분의 diagnostics 문제는 **초기 capacity를 충분히 크게 잡으면 발생하지 않는다.** 자원을 조금 더 쓰더라도 기본 capacity를 넉넉하게 설정하면:

- headroom이 오래 유지되어 draft cycle 자체가 드물어진다
- draft cycle이 필요하더라도 stride 변경 없이 headroom 보충만으로 해결되는 경우가 많다
- 시스템 전체의 버전 관리 복잡도가 크게 줄어든다

```
권장: leaf capacity는 현재 entries의 2~4배 이상
  role:    entries 5개  → capacity 20~50
  action:  entries 8개  → capacity 32~64
  resource: entries 30개 → capacity 128~256

→ 대부분의 스키마 진화가 headroom 내에서 처리됨
→ draft cycle은 구조 변경(차원 추가/제거) 시에만 발생
```

---

## 3. 배포 워크플로우

### 3.1 Draft 잠금 → 검증 → 일괄 배포

draft cycle이 끝나면, 배포는 **잠금 → 검증 → 배포**의 3단계로 진행한다.

```
1. Draft Lock — 모든 draft를 잠금 (추가 변경 차단)
   → 이 시점에서 capacity/entries가 더 이상 변하지 않음

2. Readiness Gate — DraftWorkspace.analyze()
   → diagnostics 전부 확인
   → release 순서(위상정렬) 확정
   → ready: true 판정

3. Release — leaf부터 순서대로 release + activate
   → 각 prefix release 시 stride 고정
   → migration mapping 계산 (이전 active → 새 active)
   → 모든 prefix activate 완료 = 배포 완료
```

### 3.2 버전 결정은 배포 시점의 관심사

다중 버전 처리의 책임은 **수신 측이 아니라 송신 측**에 있다. 그리고 송신 측이 "어떤 버전으로 보낼 것인가"는 **요청마다 런타임에 결정하는 것이 아니라 배포 시점에 확정**하는 것이다.

```
배포 시점:
  1. 중앙 레지스트리에서 각 prefix의 active 버전 조회
  2. "이 서비스는 perm:v2 기준으로 동작한다" 확정
  3. 배포 아티팩트에 버전 정보 고정 (빌드 설정, 환경 변수, DecodeMap 번들 등)

런타임:
  → 고정된 버전으로 encode/decode. 요청마다 레지스트리 조회 없음.
```

환경별로 버전 결정 방식이 다르다:

| 환경 | 버전 결정 시점 | 방식 |
|------|--------------|------|
| **프론트엔드** | 빌드 타임 | 빌드 시 레지스트리 조회 → 버전/stride를 번들에 고정 |
| **백엔드 서비스** | 배포 타임 | 배포 시 "이 서비스가 사용할 버전" 확정 → 설정으로 주입 |
| **서비스 간 통신** | 배포 타임 | 송신 서비스가 배포 시 대상의 active 버전을 확정 → 해당 버전으로 변환 후 전송 |

```
프론트엔드 빌드:
  build.config → registry.getActive("perm") → v2
  → DecodeMap, stride=[30,5,1]을 번들에 포함
  → 런타임에 perm:v2 기준으로만 동작
  → 버전 변경 = 재빌드·재배포

백엔드 서비스 배포:
  서비스 A 배포 시 → "perm은 v2 기준으로 보낸다" 설정 확정
  서비스 C 배포 시 → "perm:v2만 수신한다" 설정 확정
  → 둘 다 v2로 일치. 런타임 조회 불필요.

전환 시나리오:
  perm v3 릴리즈 → 서비스 C를 v3으로 재배포 → 서비스 A를 v3으로 재배포
  → 배포 순서로 전환 제어. 서비스별 독립 배포 가능.
```

### 3.3 배포 시점 버전 결정의 장점

- **런타임 의존성 없음** — 요청 경로에 레지스트리 조회가 없다. 레지스트리 장애가 서비스에 전파되지 않는다.
- **배포가 곧 버전 전환** — 버전 변경은 의도적인 재배포로만 발생한다. 런타임에 예기치 않게 버전이 바뀌지 않는다.
- **변환 비용이 사실상 없다** — decode + encode는 정수 나눗셈/곱셈 몇 번. 네트워크 비용 대비 무시 가능.

---

## 4. 저장값 마이그레이션

저장소 마이그레이션은 배포와 독립된 관심사다.

- **송신 시 변환**: 배포 시 확정된 대상 버전으로 변환 후 전송
- **저장값 마이그레이션**: read-repair 또는 배치. 자체 일정에 따라 진행
- 둘은 독립적이므로, 저장소를 급하게 마이그레이션하지 않아도 서비스 간 통신은 정상 동작한다

```
서비스 A DB: perm:v1:59 (아직 마이그레이션 안 됨)
서비스 A 설정: target_version=v2

송신 시:
  → DB에서 perm:v1:59 읽음
  → decode(v1, 59) → [2,3,4] → encode(v2, [2,3,4]) → perm:v2:79
  → 서비스 C에 perm:v2:79 전송 (서비스 C는 v2만 처리)

자체 DB 마이그레이션:
  → read-repair: 읽을 때마다 v1→v2 변환 후 재저장 (점진적)
  → 또는 batch migration: 별도 작업으로 일괄 변환
  → 자체 일정에 따라 진행. 서비스 간 통신에 영향 없음
```

---

## 5. 핵심 원리 요약

1. **계산은 결정적이다** — capacity만 있으면 stride, product, numberType을 전부 계산할 수 있다. 서비스에게 상태를 물어볼 필요가 없다.

2. **draft는 예산이다** — draft capacity는 조정 가능한 가이드라인이므로, simulate를 반복하며 최적의 capacity 조합을 찾을 수 있다.

3. **release는 위상정렬 순서다** — leaf가 먼저 확정되어야 composite의 stride가 확정된다. DraftWorkspace가 이 순서를 보장한다.

4. **diagnostics가 문제를 사전에 식별한다** — overflow, numberType 불일치, stride 변경 등을 draft 단계에서 감지하여 release 전에 해결할 수 있다.

5. **넉넉한 초기 capacity가 최선의 방어다** — 대부분의 문제는 capacity를 충분히 잡으면 원천 차단된다. draft cycle과 마이그레이션의 빈도를 줄이는 가장 효과적인 방법이다.

6. **버전 결정은 배포 시점이다** — 런타임에 버전을 결정하지 않는다. 배포가 곧 버전 전환이며, 레지스트리 장애가 서비스에 전파되지 않는다.

7. **저장값 마이그레이션은 독립적이다** — 서비스 간 통신은 송신 시 변환으로 즉시 해결. 자체 DB 마이그레이션은 별도 일정으로 진행.
