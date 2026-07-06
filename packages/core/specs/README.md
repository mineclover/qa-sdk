# @qa-sdk/core — Specs

스펙이 중앙화되었습니다. 이벤트/전송 도메인 모델은 [docs/specs/ingest/](../../../docs/specs/ingest/)에서, 저장 포트와 유틸리티는 [docs/specs/storage-system/](../../../docs/specs/storage-system/)에서 관리합니다.

| 스펙 | 위치 | 설명 |
|---|---|---|
| record.spec.md | [docs/specs/ingest/record.spec.md](../../../docs/specs/ingest/record.spec.md) | EventRecord + RecordStore |
| trace.spec.md | [docs/specs/ingest/trace.spec.md](../../../docs/specs/ingest/trace.spec.md) | TraceStore |
| session.spec.md | [docs/specs/ingest/session-spec.md](../../../docs/specs/ingest/session-spec.md) | SessionStore |
| transmission.spec.md | [docs/specs/ingest/transmission.spec.md](../../../docs/specs/ingest/transmission.spec.md) | TransmissionEnvelope + TransmissionStore |
| scenario-spec-store.spec.md | [docs/specs/storage-system/scenario-spec-store.spec.md](../../../docs/specs/storage-system/scenario-spec-store.spec.md) | ScenarioSpec + ScenarioSpecStore |
| graph.spec.md | [docs/specs/storage-system/graph.spec.md](../../../docs/specs/storage-system/graph.spec.md) | RuntimeGraph / SpecGraph + GraphStore |
| verdict.spec.md | [docs/specs/ingest/verdict.spec.md](../../../docs/specs/ingest/verdict.spec.md) | VerdictReport + VerdictStore |
| dlq-store.spec.md | [docs/specs/ingest/dlq-store.spec.md](../../../docs/specs/ingest/dlq-store.spec.md) | DlqPhase / DlqInsert / StoredDlqItem + DlqStore |
| utils.spec.md | [docs/specs/storage-system/utils.spec.md](../../../docs/specs/storage-system/utils.spec.md) | IDs + clock utilities |
