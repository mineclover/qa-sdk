# Enterprise PM Simulation — BFF Convention

> 본 문서는 simulations/enterprise-pm 의 BFF (Backend-For-Frontend) 슬라이스 컨벤션을 명문화한다. architecture-samples 의 `current/04-governance-logging-testing-bff.md` 가 BFF 가드레일(언제 BFF 를 쓰는가)을 정의하고, 본 문서는 simulations 환경의 **위치/path/메타데이터** 컨벤션을 추가로 고정한다.

## 1. 핵심 결정

| 축 | 컨벤션 | 강제성 |
|---|---|---|
| **위치** | `services/<svc>/src/<domain>/<slice>/presentation/bff/*.controller.ts` | 강제 |
| **path prefix** | `/<domain>/...` 또는 `/bff/<resource>/...` 둘 다 허용 | 자율 |
| **OpenAPI 메타** | BFF 도메인 `tags[].description` 에 "BFF" 명시 | 권장 |
| **outbox emit** | BFF controller 는 command emit 금지 (read 전용) | 강제 — `04-governance-logging-testing-bff.md` §"BFF Boundary" |

요약: **BFF 정체성은 디렉터리 위치 (`presentation/bff/`) 로 결정한다.** path prefix 는 도메인 자율(외부 호환성/gateway routing 우선). 신규 BFF 슬라이스는 `/bff/<resource>/...` 권장하지만 강제 아님.

## 2. 현재 상태 (2026-04-27)

| 서비스 | 슬라이스 | controller path | 비고 |
|---|---|---|---|
| approval-api | budget | `/bff/budget-requests` | `/bff/` prefix |
| approval-api | expense | `/bff/expense-reports` | `/bff/` prefix |
| approval-api | resource | `/bff/resource-requests` | `/bff/` prefix |
| approval-api | timeoff | `/bff/time-off-requests` | `/bff/` prefix |
| audit-browser-api | audit-explorer | `/audit/...` | 도메인 prefix (gateway `/audit/*` 로 라우팅) |
| audit-browser-api | graph-explorer | `/audit/graphs/...` | 도메인 prefix (gateway `/audit/*` 로 라우팅) |
| notification-api | notification | `/bff/notifications` | `/bff/` prefix |
| notification-api | subscription | `/bff/subscriptions` | `/bff/` prefix |
| pm-api | assignment | `/bff/assignments` | `/bff/` prefix |

가장 큰 비대칭은 audit-explorer / graph-explorer 가 `/audit/...` (도메인 prefix) 를 쓰는 점. 이는 의도적이다 — 이유는 §3 참조.

## 3. audit-explorer / graph-explorer 가 `/audit/...` 를 유지하는 이유

`simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` 의 `PROXY_TARGETS`:

```ts
{ path: "/audit", serviceKey: "sim-audit-browser-api", description: "Audit explorer" },
```

gateway 가 `/audit/*` 를 audit-browser-api 로 단일 라우팅 중. 이를 `/bff/audit/...` 로 변경하면:

- gateway proxy-routes 까지 동시 변경 필요
- OpenAPI fragment (`audit-explorer/spec.yaml`, `graph-explorer/spec.yaml`) 의 9 개 path 갱신
- 외부 운영 도구/로그 grep 패턴 영향 (e.g. `^/audit/`) — 외부 호환 깨짐

**작은 일관성을 위해 큰 호환을 깨지 않는다.** audit-explorer / graph-explorer 는 `/audit/...` 영구 유지.

## 4. 새 BFF 슬라이스를 추가할 때

1. **위치**: `services/<svc>/src/<domain>/<slice>/presentation/bff/<slice>-detail.controller.ts` (또는 `<slice>-<screen>.controller.ts`).
2. **path prefix 선택**:
   - 새 슬라이스 + 외부 호환 부담 없음 → `/bff/<resource>` 권장 (식별성 높음).
   - 기존 도메인 prefix 와 함께 노출되어야 함 → 도메인 prefix (e.g. `/audit/...`, `/projects/...`) 허용.
3. **gateway 등록**: `proxy-routes.ts` `PROXY_TARGETS` 에 path prefix 가 추가/변경되면 동시 갱신.
4. **OpenAPI fragment** (선택): BFF detail endpoint 를 외부에 노출하는 경우 `contracts/openapi/src/domains/<slice>/spec.yaml` 에 paths 추가, `tags[].description` 에 "BFF" 또는 "BFF endpoints" 표기.
   - 현재 audit-explorer / graph-explorer 만 BFF endpoints 가 OpenAPI 에 등재됨. notification/budget/assignment/subscription 등의 `/bff/<resource>/:id` detail endpoint 는 OpenAPI 미등재 (의도적 — 내부 BFF, FE 가 직접 호출).
5. **테스트**: `services/<svc>/src/<domain>/<slice>/presentation/bff/<slice>-detail.test.ts` — 다중 read 합성 + DTO 매핑 단위.

## 5. 게이트와 검증

- `pnpm --filter @qa-sdk/sim-scenarios test` — `cross-slice-conventions.test.ts` 가 BFF 위치/구조 컨벤션을 검사 (`presentation/bff/` 디렉터리에 controller 가 있는지).
- `node simulations/enterprise-pm/contracts/openapi/scripts/check-merge.mjs` — OpenAPI fragment path 충돌 + 컴포넌트 형태 일치.
- 외부 호환 변경 시 (path prefix 변경 등): gateway proxy-routes + OpenAPI fragment + scenarios 동시 PR.

## 6. 참조

- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/04-governance-logging-testing-bff.md` §"BFF Boundary" — BFF 가드레일 (언제 쓰는가, 무엇을 금지하는가)
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/README.md` §"Read Model vs BFF" — read-model 과 BFF 의 위상 차이
- `docs/plan/simulations-domain-slice-migration/phase-2-parallel.md` §"변형 포인트" — `presentation/bff/*.bff.ts`, `*.controller.ts` 패턴
- `simulations/enterprise-pm/services/gateway/src/routes/proxy-routes.ts` — gateway path prefix 등록 위치
