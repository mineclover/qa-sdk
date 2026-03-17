# demo-snapshot

> 데모/테스트용 데이터 구조의 단일 출처(SSOT)

## 개요

개별 패키지가 필요한 데이터를 쉽게 가져갈 수 있도록, **데이터의 구조와 유형**을 정의한다.

## 도메인 카탈로그

### Shopping Platform — `DEMO_ENVS`, `DEMO_ROLES_*`, `DEMO_SVC`, ...

쇼핑 플랫폼의 서비스/권한/이벤트 인덱스 체계.

```typescript
import {
  DEMO_ROLES_V1, DEMO_ROLES_V2, DEMO_KO,
  DEMO_SVC, DEMO_FEATURES_V2,
  buildDemoRegistryInput,
  demoCalcPermAddr,
} from "demo-snapshot";
```

| Export | 설명 |
|--------|------|
| `DEMO_ENVS/REGIONS/SVCS/NSS` | 서비스 차원 엔트리 |
| `DEMO_ROLES_V1/V2` | 역할 차원 (v1: 5개, v2: 6개) |
| `DEMO_EVENTS_V1/V2` | 이벤트 차원 (v1: 7개, v2: 9개) |
| `DEMO_SVC` | 사전 계산된 서비스 주소 상수 |
| `DEMO_FEATURES_V1/V2` | 기능 정의 (역할 매핑, 이벤트 값 포함) |
| `DEMO_KO` | 한국어 라벨 |
| `buildDemoRegistryInput()` | MetaRegistry 생성용 순수 데이터 객체 |
| `demoCalcPermAddr/EvtAddr` | 주소 계산 헬퍼 |

### RBAC — `DEMO_RBAC`

역할 기반 접근 제어 (role × action × resource).

```typescript
import { DEMO_RBAC, DEMO_RBAC_POLICIES } from "demo-snapshot";

DEMO_RBAC.dims.role.entries    // ["admin", "editor", "viewer"]
DEMO_RBAC.dims.action.entries  // ["read", "write", "delete", "admin"]
DEMO_RBAC.dims.resource.entries // ["dashboard", "reports", "settings", "users"]
```

### Content — `DEMO_CONTENT`

콘텐츠 플랫폼 (tag × category × status × locale × channel).

```typescript
import { DEMO_CONTENT } from "demo-snapshot";

DEMO_CONTENT.dims.tag.entries      // ["frontend", "backend", "devops", "ai", "database"]
DEMO_CONTENT.dims.category.entries // ["tech", "design", "product", "culture"]
DEMO_CONTENT.dims.status.entries   // ["draft", "published", "archived"]
```

### Tracking — `DEMO_TRACKING`

사용자 행동 추적 (action × page × userType).

```typescript
import { DEMO_TRACKING } from "demo-snapshot";

DEMO_TRACKING.dims.action.entries   // ["click", "view", "scroll", "submit"]
DEMO_TRACKING.dims.page.entries     // ["home", "product", "cart", "checkout"]
DEMO_TRACKING.dims.userType.entries // ["guest", "member", "premium"]
```

### Relational — `DEMO_RELATIONAL`

관계 모델 (subject_kind × predicate × object_kind).

```typescript
import { DEMO_RELATIONAL, RELATIONAL_RESERVED } from "demo-snapshot";

DEMO_RELATIONAL.dims.subjectKind.entries // ["_", "user", "role", "group"]
RELATIONAL_RESERVED.NULL                 // "_"
```

### Shopping Services — `DEMO_SHOPPING_SERVICES`

쇼핑 플랫폼 서비스 컨텍스트 (리소스/액션 정의).

```typescript
import { DEMO_SHOPPING_SERVICES } from "demo-snapshot";

DEMO_SHOPPING_SERVICES[0].id        // "shop/payment"
DEMO_SHOPPING_SERVICES[0].resources // ["products", "orders", "payments", ...]
```

## 커스텀 타입

모든 도메인 데이터는 `DomainDataset<D>` 구조를 따른다:

```typescript
import type { DomainDim, DomainDataset } from "demo-snapshot";

interface MyDims {
  env: DomainDim;
  tier: DomainDim;
}

const MY_DATASET: DomainDataset<MyDims> = {
  id: "my-domain",
  name: "커스텀 도메인",
  description: "...",
  dims: {
    env: { entries: ["dev", "prod"], ko: { dev: "개발", prod: "운영" } },
    tier: { entries: ["free", "pro"], capacity: 8 },
  },
};
```
