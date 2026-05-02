---
def:
  tier: component
  id: runtime-flow-rollout
  address: def_document:v2:273559
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [observability, runtime, versioning]
  links:
    - target: apm-runtime-system
      type: refines
---

# 런타임 흐름 도입 규칙

## 목적 ^purpose

운영 흐름 문서에서 빠른 참조가 필요한 심볼 요약, 구현 현황, 단계별 도입 순서를 분리해 런타임 변경 관리 규칙을 정리한다.

## 구성 ^overview

- `경로 심볼 요약`: 동기/비동기/디버깅 경로를 구분하는 운영자용 축약 표를 정의한다.
- `구현 현황`: 각 경로별 완료/보류 범위와 스토어 드라이버 지원 현황을 기술한다.
- `도입 순서 규칙`: 저장 → 검증 → 집계 → 디버깅 → 최적화 순서의 근거를 명시한다.
- `되돌리기 전략`: 각 경로 도입 시 장애 발생 시 되돌리기 방법을 정리한다.

## 경로 심볼 요약

| 심볼 | 경로 | 지연 허용 | 실패 시 |
|------|------|-----------|---------|
| P1-SYNC | Phase 1 동기 수집 | < 100ms | 400/500 응답 + DLQ |
| P2-ASYNC | Phase 2 비동기 재구성 | 초~분 | 재시도 (TaskQueue) |
| DBG-STREAM | 실시간 디버깅 | 실시간 | 연결 끊김 (데이터 손실 없음) |
| CONV-PIPE | Convergence 파이프라인 | 분~시간 | 격리 (verdict 차단 안 함) |

## 구현 현황

### Phase 1 (동기 수집) — 완료
- RecordStore: memory O / d1 O / pg O / clickhouse O
- TraceStore: memory O / d1 O / pg O
- SessionStore: memory O / d1 O / pg O
- TransmissionStore: memory O
- DlqStore: memory O
- 전송 프로토콜: JSON O / QAPB O / Protobuf(codec-proto) O

### Phase 2 (비동기) — 완료
- TaskQueue: InMemory O / BullMQ O
- phase-two-worker: 재구성 + verdict 판정 O
- convergence-pipeline: 메트릭 집계 + 패턴 분류 O (선택적 활성화)

### 실시간 디버깅 — 완료
- SSE streams: O (RecordStreamBroker)
- WebSocket: O (debug-ws.ts)
- gRPC debug: O (GRPC_PORT 설정 시)

### 미도입
- ClickHouse: RecordStore만 구현, TraceStore/SessionStore 미구현
- BullMQ 분산: 단일 프로세스만 검증, multi-worker 미검증

## 도입 순서 규칙

새 기능 경로를 추가할 때의 순서 원칙:

1. **저장 먼저**: 데이터가 유실 없이 쌓여야 다음 단계가 의미 있다.
2. **검증 다음**: Zod 스키마 + registry 검증으로 잘못된 데이터가 저장되지 않게 한다.
3. **집계/재구성**: 저장된 데이터를 기반으로 Phase 2 verdict, convergence를 추가한다.
4. **디버깅**: 데이터 흐름이 안정된 후 실시간 스트림과 디버그 UI를 연결한다.
5. **최적화**: 성능 프로파일링 후 ClickHouse, BullMQ 등 특화 백엔드를 도입한다.

신규 기능은 **가장 좁은 경로**(단일 스토어, 단일 프로세스)부터 붙이고, 공통 모듈화는 경로 안정화 이후에 한다.

## 되돌리기 전략

| 경로 | 되돌리기 방법 | 비용 |
|------|---------------|------|
| STORE_DRIVER 변경 | 환경변수를 memory로 복원 | 저장 데이터 유실 |
| Phase 2 활성화 | TaskQueue를 InMemory로 변경 | 미처리 작업 유실 |
| Convergence 비활성화 | CONVERGENCE_ENABLED=false | verdict만 동작, 집계 중단 |
| 디버깅 스트림 | 포트 미설정으로 비활성화 | 실시간 관찰 불가 |

경로를 늘릴 때는 런타임 비용보다 **장애 시 되돌리기 쉬운지** 먼저 본다. 환경변수 하나로 비활성화할 수 없는 기능은 도입하지 않는다.
