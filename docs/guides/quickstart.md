---
def:
  id: quickstart-guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: system-data-flow
      type: refines
---
# Quickstart — 차원 압축 기반 DSL DB

## 목적 ^purpose

시스템 내 enum, 이벤트, 권한, API, 화면 경로를 prefix로 관리하는 개발자 시작 가이드. 문자열만 다루고, 정수는 시스템이 파생한다.

## 구성 ^overview

- **prefix 개념**: 각 prefix는 차원의 조합(role×action, method×path 등)으로 유일한 정수 주소를 파생하는 의사결정 단위
- **CLI 6종**: encode(문자열→주소), decode(주소→문자열), resolve(자동 마이그레이션), find-version(버전 탐색), impact(영향 분석), derive-refs(정합성 검증)
- **SDK 사용법**: createQaContext로 초기화 후 encode/decode/resolve 호출, env·region·service는 SDK가 자동 주입
- **환경 변수**: QA_ENV, QA_REGION, QA_SERVICE, QA_NAMESPACE 4종으로 런타임 컨텍스트 설정
- **의사결정 7단계**: 기존 축/prefix 존재 여부 → 확장 vs 신규 → Domain 소속 → 연결 관계 → capacity → 소비자 영향 순서로 판단
- **핵심 원칙**: 문자열은 영원히 고정, 정수는 shape에서 파생, 마이그레이션은 decode→re-encode로 항상 성공

---

## 핵심 개념

```
prefix = 의사결정의 결과 단위

permission prefix:  role × action     → "어떤 역할이 어떤 행위를 하는가"
api prefix:         method × path     → "어떤 API가 호출되는가"
page_view prefix:   page × locale     → "어떤 화면을 누가 보는가"

각 조합 = 유일한 정수 주소
문자열은 영원히 고정. 정수는 shape에서 파생.
```

---

## CLI 사용법

### encode — 문자열 → 주소

```bash
# 권한 인코딩
qa encode permission --role admin --action write
# → permission:v4:ADDRESS

# API 인코딩
qa encode api --http_method POST --api_path orders --api_version v2
# → api:v1:ADDRESS

# 흐름 포인트
qa encode flow_point --flow_name checkout --flow_step success --flow_variant default
# → flow_point:v1:ADDRESS
```

### decode — 주소 → 문자열

```bash
qa decode "permission:v4:65536"
# → role: admin, action: read, ...

# prefix_ref까지 재귀 해석
qa decode "permission:v1:65536" --deep
# → perm_svc → service:v1:65536 → env: prod, region: asia, ...
```

### resolve — 자동 마이그레이션

```bash
# 구버전 주소를 최신으로 변환
qa resolve "permission:v1:5"
# → permission:v4:NEW_ADDRESS
# → migrated: true
# → values: { role: "admin", action: "write" }
```

### find-version — 문자열이 있는 버전 찾기

```bash
qa find-version role auditor
# → v4: position 6

qa find-version role customer
# → v2: position 5
# → v3: position 5
# → v4: position 5
```

### impact — 영향 분석

```bash
qa impact --axis role
# → 영향 prefix: permission
# → 영향 domain: shopping-domain
# → 영향 consumer: auth-service, payment-service
# → stride-break: false
```

### derive-refs — refEntries 정합성

```bash
qa derive-refs --check
# → ✅ 9개 refEntries 전부 일치

qa derive-refs --show
# → 의미 ↔ 정수 매핑 표시
```

---

## 앱 코드에서 사용

```typescript
import { createQaContext } from "@qa-sdk/sdk";
import { DEMO_CATALOG } from "demo-snapshot";

// SDK 초기화 — 환경 변수 자동 읽기
const qa = createQaContext({
  catalog: DEMO_CATALOG,
  // env: process.env.QA_ENV,      // 자동
  // region: process.env.QA_REGION, // 자동
});

// 인코딩 — 비즈니스 차원만 지정
const addr = qa.encode("permission", { role: "admin" });
// → "permission:v4:ADDRESS"
// env, region, service는 SDK가 자동 주입

// 디코딩 — 문자열로 복원
const values = qa.decode(addr);
// → { role: "admin", perm_svc: 65536, ... }

// 마이그레이션 — 구버전 자동 변환
const resolved = qa.resolve("permission:v1:5");
// → { address: "permission:v4:NEW", values: {...}, migrated: true }
```

### 환경 변수

```bash
QA_ENV=prod          # dev, stage, prod, test, local
QA_REGION=asia       # asia, usa, ...
QA_SERVICE=payment   # 서비스 이름
QA_NAMESPACE=shop    # 네임스페이스
```

---

## 의사결정 — 새 기능 추가 시

새 요구사항이 올 때 7개 질문:

| # | 질문 | CLI |
|---|---|---|
| 1 | 기존 축에 있는가? | `qa find-version <axis> <entry>` |
| 2 | 기존 prefix에 있는가? | `qa list-prefixes` |
| 3 | 확장 vs 신규? | 원칙: 보통 신규 |
| 4 | 어떤 Domain? | `qa dkg domains` |
| 5 | 다른 prefix와 연결? | `qa impact --prefix <id>` |
| 6 | capacity 충분? | `qa list-axes` → headroom 확인 |
| 7 | 기존 소비자 영향? | `qa impact --axis <id>` |

---

## 원칙

- **문자열은 영원히 고정.** "admin"은 v1에서도 v99에서도 "admin".
- **정수는 파생.** capacity가 바뀌면 정수가 바뀌지만 문자열은 보존.
- **마이그레이션 = decode → re-encode.** 문자열이 고정이므로 항상 성공.
- **축을 비대하게 만들지 말고 새 prefix를 만든다.** prefix = 의사결정 단위.
- **capacity는 넉넉하게.** stride-break 비용 >> headroom 비용.
