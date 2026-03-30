---
def:
  id: prefix-guide-env-override
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [entry-point, runtime, observability]
  links:
    - target: prefix-guide
      type: refines
---

# SDK 환경 오버라이드 패턴

## 목적 ^purpose

env, region, service 같은 인프라 차원을 SDK 부트 시 환경 변수로 주입하는 패턴을 정리한다. PartialBinder를 통해 개발자가 비즈니스 차원만 다루도록 인프라 차원을 은닉한다.

## 문제

env, region, service 같은 인프라 차원은 **코드에 하드코딩하지 않는다.** 배포 환경마다 다르다.

```
dev:  env=dev,  region=asia, service=shopping-web
prod: env=prod, region=usa,  service=shopping-web
test: env=test, region=asia, service=shopping-web
```

## 해법: SDK 부트 시 환경 주입

```typescript
// ── SDK 초기화 (앱 시작 시 1회) ──────────────────────

import { createQaContext } from "@qa-sdk/sdk";

const qa = createQaContext({
  // 환경 변수에서 주입 — 배포 환경마다 다름
  env:       process.env.QA_ENV       ?? "dev",
  region:    process.env.QA_REGION    ?? "asia",
  service:   process.env.QA_SERVICE   ?? "shopping-web",
  namespace: process.env.QA_NAMESPACE ?? "shop",
});

// 이 4개 차원은 고정. 이후 모든 encode에 자동 포함.
```

```typescript
// ── 개발자 코드 (비즈니스 로직만 작성) ────────────────

// 권한 체크: 개발자는 role, action만 지정
const addr = qa.encode("permission", { role: "admin", action: "write" });
// 내부적으로: { env: "prod", region: "asia", service: "shopping-web",
//              namespace: "shop", role: "admin", action: "write" }
// → 하지만 개발자는 { role, action }만 알면 된다

// 이벤트 기록: 개발자는 event_name, initiator만 지정
qa.track("event", { event_name: "order.created", initiator: "web" });
// 내부적으로: service 컨텍스트 자동 포함

// 페이지 추적: 개발자는 page, locale만 지정
qa.track("page", { page: "checkout", locale: "ko", userType: "premium" });
```

## 환경 변수 표준

| 환경 변수 | 차원 | 예시 | 설명 |
|---|---|---|---|
| `QA_ENV` | env | dev, stage, prod, test | 배포 환경 |
| `QA_REGION` | region | asia, usa, eu | 서비스 리전 |
| `QA_SERVICE` | svc_name | shopping-web, auth | 서비스 이름 |
| `QA_NAMESPACE` | namespace | shop, cms | 네임스페이스 |
| `QA_BUILD` | (메타) | 2026.03.20.1 | 빌드 식별자 |

## PartialBinder 연동

```typescript
// SDK 내부 구현:
// 환경 변수 → service prefix 고정 → PartialBinder 생성

const serviceBinder = createBinder(codec, "service", {
  env: config.env,
  region: config.region,
  svc_name: config.service,
  namespace: config.namespace,
});
// → free dimensions: 없음 (service 주소 완전 결정)
// → service address: 40 (예: prod/asia/shopping-web/shop)

const permissionBinder = createBinder(codec, "permission", {
  perm_svc: serviceBinder.resolveId({}),  // service 주소를 고정 차원으로
});
// → free dimensions: [role]
// → qa.encode("permission", { role: "admin" }) 로 충분
```

## 테스트 환경

```typescript
// test에서는 env=test, region=asia로 자동 설정
// 같은 코드가 다른 주소를 생성하지만 같은 좌표 체계

// test
const qa = createQaContext({ env: "test", region: "asia", ... });
qa.encode("permission", { role: "admin", action: "write" });
// → permission:v1:TEST_ADDRESS (env=test이므로 다른 주소)

// prod
const qa = createQaContext({ env: "prod", region: "asia", ... });
qa.encode("permission", { role: "admin", action: "write" });
// → permission:v1:PROD_ADDRESS (env=prod이므로 다른 주소)

// 차원은 같다. 주소만 다르다. 분석 시 env 차원으로 필터.
```
