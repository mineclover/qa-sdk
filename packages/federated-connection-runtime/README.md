# federated-connection-runtime

`federated-connection` 계약을 운영 흐름으로 조합하는 runtime surface다.

## 책임

- mapping/relation과 observation metadata의 memory/SQLite persistence
- source observation을 저장하고 identity/status/revision/payload hash precondition을 고정
- 주입된 `SourceIdentifierRegistry`로 lookup/snapshot을 검증하고 identifier rule version을 observation에 고정
- relation graph에서 direct/indirect impact candidate와 propagation action 생성
- policy 기반 plan 생성과 approval 상태 관리
- 외부 source execution adapter를 승인된 plan에만 연결
- execute 후 re-fetch하고 expected revision/payload hash를 비교해 `applied`와 `verified`를 분리하며 최신 observation metadata를 갱신
- actor/source/relation/policy/plan/action/result를 connection audit event로 기록하고 외부 evidence sink로 전달

이 패키지는 source API, ERP/CRM business logic, source payload authority를 소유하지 않는다. 실제 source write는 `SourceExecutionAdapter` 구현자가 소유하며, runtime은 plan·precondition·re-fetch·evidence 상태만 관리한다.

## 최소 운영 흐름

```text
SourceAdapter
  -> observe()
  -> StoredSourceObservation
  -> createPlan(policy)
  -> approve()
  -> execute(SourceExecutionAdapter)
  -> re-fetch
  -> applied / verified / stale
```

`automatic` 정책도 high-risk candidate가 있으면 자동 승인하지 않는다. `review_required`, `notify_only`, `validate_only`, `blocked`는 source mutation으로 이어지지 않는다.
