# federated-connection

qa-sdk가 기존에 지향해온 중간 연결 방향의 순수 계약 표면이다.

이 패키지는 원본 업무 시스템을 구현하지 않는다. source local ID를 보존하면서 `SourceRef`, `ConnectionRef`, `Mapping`, `TypedRelation`을 표현하고, 인메모리 registry에서 mapping conflict·resolve·snapshot을 결정론적으로 처리한다.

## 책임

- source namespace와 source revision을 포함한 `SourceRef` 보존
- source/entity별 유한 local ID·revision 규칙과 version 관리
- `SourceIdentifierRegistry`를 통한 active 규칙 기반 lookup/snapshot 검증
- qa-sdk 연결 identity인 `ConnectionRef` 관리
- source-to-connection mapping과 ambiguity/conflict 판정
- source 또는 connection endpoint 사이 typed relation 관리
- DB, network, ERP business logic, source write는 소유하지 않음

## 사용 예

```ts
import { ConnectionRegistry } from 'federated-connection';

const registry = new ConnectionRegistry();

registry.registerMapping({
  id: 'map-erp-customer-7',
  source: {
    sourceSystem: 'erp',
    entityType: 'customer',
    localId: 'cust-7',
    revision: 'rev-3',
  },
  target: { namespace: 'qa', connectionId: 'customer-7', version: 1 },
  status: 'active',
  provenance: { kind: 'manual', ref: 'review-1' },
});

const resolution = registry.resolve({
  sourceSystem: 'erp',
  entityType: 'customer',
  localId: 'cust-7',
  revision: 'rev-3',
});
```

Source-specific adapters implement `SourceAdapter` and return a revisioned, read-only-by-contract `SourceSnapshot`. `observeSource()` compares the previous snapshot by revision/hash and produces change evidence; it does not persist the payload or write to the source.

Source-specific identifier rules are registered independently by `sourceSystem`, `entityType`, and rule version. A runtime may inject `SourceIdentifierRegistry` to validate lookups and pin the rule version into observation metadata; the registry does not merge local IDs across source namespaces.

`ConnectionRegistry`는 persistence adapter가 아니다. snapshot을 외부 저장소로 넘기는 경계는 호출자가 소유한다.
