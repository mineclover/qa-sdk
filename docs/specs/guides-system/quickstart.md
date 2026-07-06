---
def:
  tier: component
  id: quickstart-guide
  type: knowledge
  knowledge_kind: guide
  address: def_document:v2:136197
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [entry-point]
  links:
    - target: system-data-flow
      type: traces_to
sources:
  - packages/context/src/qa-context.ts
  - packages/sdk/src/index.ts
  - packages/core/src/catalog/runtime.ts
  - packages/core/src/catalog/catalog.types.ts
  - packages/cli/src/command-groups/spec.commands.ts
  - packages/cli/src/command-groups/prefix.commands.ts
  - packages/cli/src/command-groups/dkg.commands.ts
---
# Quickstart — 차원 압축 기반 DSL DB

## 목적 ^purpose

시스템 내 enum, 이벤트, 권한, API, 화면 경로를 prefix로 관리하는 개발자 시작 가이드. 문자열만 다루고, 정수는 시스템이 파생한다.

## 구성 ^overview

- **prefix 개념**: 각 prefix는 차원의 조합(role×action, method×path 등)으로 유일한 정수 주소를 파생하는 의사결정 단위
- **운영 CLI 표면**: `qa-sdk spec resolve/decode`, `qa-sdk prefix find/drift/impact/migrate`, `qa-sdk dkg axes/prefixes/domains/overlaps/add-entry`
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

## 현재 CLI 표면

### spec resolve — 값 JSON → export title

```bash
qa-sdk spec resolve --prefix permission --values '{"role":"admin"}' --catalog
qa-sdk spec resolve --prefix flow_point --values '{"flow_name":"checkout","flow_step":"success","flow_variant":"default"}' --catalog
```

런타임 주소 문자열이 필요하면 앱 코드에서 `createQaContext().encode()`를 사용한다.

### spec decode — 주소 → 문자열

```bash
qa-sdk spec decode --address "permission:v4:65536" --catalog
qa-sdk spec decode --address "permission:v1:65536" --deep --catalog
```

### SDK resolve — 자동 마이그레이션

```typescript
const resolved = qa.resolve("permission:v1:5");
// { address: "permission:v4:NEW_ADDRESS", migrated: true, values: {...} }
```

### prefix / dkg — 탐색과 영향 분석

```bash
qa-sdk prefix find permission --summary
qa-sdk prefix impact permission
qa-sdk prefix drift packages/demo-types/src
qa-sdk dkg axes --group-by prefix
qa-sdk dkg impact role
qa-sdk dkg overlaps
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
| 1 | 기존 축에 있는가? | `qa-sdk dkg axes` |
| 2 | 기존 prefix에 있는가? | `qa-sdk dkg prefixes` |
| 3 | 확장 vs 신규? | 원칙: 보통 신규 |
| 4 | 어떤 Domain? | `qa-sdk dkg domains` |
| 5 | 다른 prefix와 연결? | `qa-sdk prefix impact <id>` |
| 6 | capacity 충분? | `qa-sdk prefix find <prefixId> --summary` |
| 7 | 기존 소비자 영향? | `qa-sdk dkg impact <axisId>` |

---

## 원칙

- **문자열은 영원히 고정.** "admin"은 v1에서도 v99에서도 "admin".
- **정수는 파생.** capacity가 바뀌면 정수가 바뀌지만 문자열은 보존.
- **마이그레이션 = decode → re-encode.** 문자열이 고정이므로 항상 성공.
- **축을 비대하게 만들지 말고 새 prefix를 만든다.** prefix = 의사결정 단위.
- **capacity는 넉넉하게.** stride-break 비용 >> headroom 비용.
