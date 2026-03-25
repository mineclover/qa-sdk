---
def:
  id: axis-boundary-spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
---

# Axis Boundary — 축에 넣을 것과 넣지 않을 것

## 목적 ^purpose

이 시스템의 핵심 판단: 무엇이 axis이고 무엇이 아닌가.
잘못 구분하면 시스템이 방해가 된다.

---

## 판단 기준

```
axis에 넣는다:
  · 유한하다 (경우의 수가 정해져 있다)
  · 의사결정의 대상이다 ("admin을 추가할까?"는 결정)
  · 변경이 드물다 (한 분기에 1~2회)
  · 시스템 전역에서 공유된다 (여러 prefix가 참조)

axis에 넣지 않는다:
  · 무한하거나 자주 변한다 (API 경로, 사용자 ID, 타임스탬프)
  · 자동으로 결정된다 (req.method, req.path는 프레임워크가 제공)
  · 특정 서비스에서만 쓰인다 (전역 공유 아님)
  · 추가할 때 의사결정이 필요 없다 ("새 API 추가"는 일상 작업)
```

---

## 분류표

### axis에 넣는 것 (의사결정 대상, 유한, 공유)

| 범주 | 축 예시 | 이유 |
|---|---|---|
| **역할/권한** | role, rbac_role, action | 권한 체계는 의사결정. 추가/제거에 검토 필요. |
| **환경/인프라** | env, region, namespace | 배포 환경은 고정. 리전 추가는 인프라 결정. |
| **상태** | status, lifecycle | 상태 전이 모델은 설계 결정. |
| **분류** | category, tag, locale, channel | 콘텐츠/사용자 분류 체계는 공유 어휘. |
| **리소스 타입** | resource_type | api/page/webhook/grpc — 유형은 유한. |
| **HTTP 메서드** | http_method | GET/POST/PUT/DELETE/PATCH — 고정. |
| **API 버전** | api_version | v1/v2 — 의사결정. |
| **흐름 단계** | flow_step, flow_variant | 흐름의 구조는 설계 결정. |
| **사용자 유형** | userType | guest/member/premium — 비즈니스 결정. |
| **관계 유형** | subjectKind, predicate, objectKind | 관계 모델은 설계 결정. |

### axis에 넣지 않는 것 (동적, 무한, 자동)

| 범주 | 예시 | 대신 | 이유 |
|---|---|---|---|
| **API 경로** | /orders, /users/profile | table_ref 또는 runtime ref | API 추가마다 축 수정은 오버헤드 |
| **페이지 URL** | /checkout/step2 | table_ref 또는 패턴 | URL은 무한. 논리적 page만 axis. |
| **사용자 ID** | user:42 | table_ref | 무한. 좌표에 인코딩 불가. |
| **타임스탬프** | 2026-03-20T... | EventRecord.timestamp | 무한. 좌표 밖. |
| **요청 ID** | req-abc-123 | trace_id | 무한. 추적 전용. |
| **서비스 인스턴스** | pod-xyz | 인프라 메타 | 동적. 스케일에 따라 변동. |
| **흐름 이름** | checkout, signup | axis (유한하면) 또는 table_ref (많으면) | 판단 필요 — 아래 참조 |

### 경계선 — 판단이 필요한 것

| 항목 | 현재 | 판단 |
|---|---|---|
| **flow_name** | axis (capacity 64) | 흐름이 64개 이내면 axis. 넘으면 table_ref로 전환. |
| **svc_name** | axis (capacity 32) | 서비스 수가 32개 이내면 axis. 마이크로서비스가 많아지면 table_ref. |
| **event_name** | axis (capacity 64) | 이벤트 종류가 64개 이내면 axis. 넘으면 계층화 필요. |
| **api_path** | ~~axis~~ → **제거** | API 경로는 동적. axis가 아님. |

---

## api prefix 재설계

### 이전 (문제 있음)

```
api prefix: http_method × api_path × api_version
→ api_path가 axis: ["users", "orders", "products", ...]
→ API 추가마다 축 수정 필요 → 오버헤드
→ 이건 라우트 테이블 관리지 의사결정 관리가 아님
```

### 이후 (수정)

```
endpoint prefix: service_ref × resource_type × http_method × api_version
→ resource_type: ["api", "page", "webhook", "grpc"] — 유한, 의사결정 대상
→ http_method: ["GET", "POST", "PUT", "DELETE", "PATCH"] — 유한, 고정
→ api_version: ["v1", "v2"] — 유한, 의사결정 대상
→ service_ref: service prefix 참조 — 어떤 서비스인가

API 경로(/orders, /users)는 좌표 밖:
  EventRecord에 runtime ref로 태깅:
    { address_context: { endpoint: "endpoint:v1:ADDR" },
      resource_path: "/api/v1/orders" }  ← 좌표 밖 메타데이터
```

### 이점

```
이전: API 추가 → axis entry 추가 → 의사결정 프로세스
이후: API 추가 → 코드에 라우트 추가 → 끝. 축 수정 불필요.

좌표로 추적하는 것:
  "prod/asia/payment 서비스의 api 엔드포인트에 POST v1으로 접근"
  → endpoint:v1:ADDR = service_ref × resource_type(api) × method(POST) × version(v1)

좌표로 추적하지 않는 것:
  "구체적으로 /orders에 접근" → resource_path 필드 (좌표 밖)
```

---

## 서비스 계층 주소 — prefix_ref로 트리 표현

### 계층 구조

```
service prefix:    env × region × svc_name × namespace
                   → "어떤 서비스인가" (인프라 식별)

endpoint prefix:   service_ref × resource_type × http_method × api_version
                   → "서비스의 어떤 종류의 엔드포인트에 어떻게 접근하는가"

이 둘이 prefix_ref로 연결:
  endpoint.service_ref → service prefix

service:v1:65536 = prod/asia/payment/shop
endpoint:v1:ADDR = service(65536) × resource_type(api) × method(POST) × version(v1)

endpoint 주소 하나를 decode하면:
  → service_ref → decode → env: prod, region: asia, svc_name: payment
  → resource_type: api
  → http_method: POST
  → api_version: v1
  전체 트리가 정수 하나에.
```

### 좌표 밖 메타데이터

```typescript
// 이벤트 기록 시:
logger.log({
  event_key: "api.request",
  event_version: "v1",
  address_context: {
    endpoint: qa.encode("endpoint", {
      resource_type: "api",
      http_method: req.method,
      api_version: "v1",
    }),
    // service는 qa.track()이 자동 주입
  },
  // 좌표 밖 — 구체적 경로, 응답 시간 등
  payload: {
    resource_path: req.path,       // "/api/v1/orders"
    response_time_ms: 142,
    status_code: 200,
  },
});
```

---

## 미들웨어 자동 태깅 패턴

개발자가 수동으로 dims를 입력하면 방해된다. 미들웨어가 자동 추출:

```typescript
// 미들웨어: req에서 자동 추출 → address_context 태깅
function qaMiddleware(qa: QaContext) {
  return (req, res, next) => {
    // http_method, api_version은 req에서 자동 추출
    const method = req.method;                    // "POST"
    const version = req.path.match(/\/v(\d+)\//)?.[1] ?? "1";  // "v1"

    // resource_type은 경로 패턴에서 추론
    const resourceType = req.path.startsWith("/api/") ? "api"
      : req.path.startsWith("/webhook/") ? "webhook"
      : "page";

    // 자동 태깅
    req.addressContext = qa.track({
      endpoint: {
        resource_type: resourceType,
        http_method: method,
        api_version: `v${version}`,
      },
    }).address_context;

    // 좌표 밖 메타데이터
    req.resourcePath = req.path;

    next();
  };
}

// 개발자가 추가로 태깅할 것만:
app.post("/api/v1/orders", (req, res) => {
  // 비즈니스 분기점만 수동
  qa.tag(req, {
    flow_point: { flow_name: "checkout", flow_step: "success", flow_variant: "default" },
  });
});
```

---

## 변경 사항 요약

| 항목 | 이전 | 이후 |
|---|---|---|
| `api_path` axis | ["users","orders",...] | **제거** — 동적 경로는 axis가 아님 |
| `api` prefix | method × path × version | **→ `endpoint`**: service_ref × resource_type × method × version |
| `resource_type` axis | 없음 | **신규**: ["api","page","webhook","grpc"] |
| API 경로 | 좌표에 인코딩 | **좌표 밖** payload.resource_path |
| 태깅 방식 | 수동 입력 | **미들웨어 자동 추출** |
