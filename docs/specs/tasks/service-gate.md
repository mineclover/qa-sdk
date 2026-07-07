---
def:
  id: task-service-gate
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: gate-service
  tags: [runtime, task-record]
  links:
    - target: gate-system
      type: traces_to
    - target: gate-api
      type: traces_to
sources:
  - packages/gate-service/README.md
  - packages/gate-service/src/app.ts
  - packages/gate-service/src/routes/gate.ts
  - packages/gate-service/src/services/cache-invalidation.ts
  - packages/gate-service/src/app.test.ts
  - docs/specs/gate/gate-api.spec.md
---

# gate-service 구축

> GateEngine을 RPC 서비스로 노출하여 주소 상태 관리를 네트워크 경계 너머로 확장한다.

## 목적 ^purpose

gate-service 구축 task의 구현 완료 위치를 추적한다. API 계약은 `gate-api`, 전체 시스템은 `gate-system`, 런타임 surface는 `packages/gate-service`가 소유한다.

## 흐름 심볼

`[S2]` checkGate · `[A4]` recompute (MQ 트리거) · `[A5]` gateFilterRanges

## 현재 상태

| 항목 | 라이브러리 | 서비스 |
|---|---|---|
| GateEngine | ✅ index-meta | ✅ `packages/gate-service/src/lib/gate-service.ts` |
| AddressStateStore | ✅ Memory + SQL | ✅ gate routes + app tests |
| invalid-ranges | ✅ 순수 함수 | ✅ `/gate/filter-ranges` |
| cache invalidation | ✅ event bus | ✅ `cache-invalidation.ts` |

## 선행 조건

- infra-sql-adapters H-1 (VersionLifecycleStore SQL) — 프로덕션 배포 시
- unit-1-async-worker — A4 MQ 트리거 연동 시

**단, 라이브러리 래핑 (E-1)은 독립 진행 가능.**

## spec.todo 매핑

E-1, E-2, E-3, E-4

## 작업 항목

| # | spec.todo | 작업 | 설명 |
|---|---|---|---|
| 1 | E-1 | 패키지 스캐폴딩 | Hono.js, decode-service 패턴. 6개 RPC 엔드포인트 |
| 2 | E-1 | checkGate / classifyAddress / getStateRanges | 조회 계열 (GateEngine → AddressStateStore 위임) |
| 3 | E-1 | recompute / cascadeRecompute / gateFilterRanges | 계산 계열 |
| 4 | E-2 | 이벤트 수신 인터페이스 | release/flagChange → recompute 트리거. Unit 1 TaskQueue 또는 별도 이벤트 포트 |
| 5 | E-3 | 캐시 무효화 브로드캐스트 | recompute 완료 → 다른 서비스에 무효화 알림 (SSE/webhook) |
| 6 | E-4 | shouldVerify 재확인 경로 | open 상태 주소의 최신 상태 조회 |
| 7 | — | 테스트 | 엔드포인트 + 에러 매핑 + 이벤트 트리거 |

## 산출물

- `packages/gate-service/` 패키지
- 6개 RPC 엔드포인트
- 이벤트 수신 인터페이스
- gate-api.spec.md `[S2]` `[A4]` `[A5]` → 📋 에서 ✅로 전환

## 관련 소스

- `packages/gate-service/src/routes/gate.ts`
- `packages/gate-service/src/services/cache-invalidation.ts`
- `packages/gate-service/src/app.test.ts`
- `docs/specs/gate/gate-api.spec.md`
