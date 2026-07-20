---
def:
  id: federated-connection-contract
  type: spec
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: federated-connection
  tags: [structural, connection, identity, mapping, relation]
  links:
    - target: federated-architecture-governance
      type: implements
    - target: system-packages
      type: refs
    - target: definition-catalog-spec
      type: constrains
    - target: dkg-system
      type: constrains
    - target: spec-verification-system
      type: refs
    - target: federated-connection-runtime
      type: refs
sources:
  - packages/federated-connection/src/contract.ts
  - packages/federated-connection/src/keys.ts
  - packages/federated-connection/src/source-adapter.ts
  - packages/federated-connection/src/validate.ts
  - packages/federated-connection/src/registry.ts
  - packages/federated-connection/src/identifier-registry.ts
  - packages/federated-connection/src/index.ts
  - packages/federated-connection/__tests__/registry.test.ts
  - packages/federated-connection/__tests__/identifier-registry.test.ts
  - packages/federated-connection/__tests__/source-adapter.test.ts
---

# Federated Connection Contract

## 목적 ^purpose

qa-sdk가 기존에 지향해온 중간 연결 방향을 순수 계약으로 구현한다. 원본 시스템의 local ID와 revision을 보존하면서 source별 유한 식별자 규칙, qa-sdk 연결 identity, mapping 상태, typed relation을 표현하고 검증한다.

이 문서는 ERP나 source 업무 모델의 명세가 아니다. source write, persistence, network adapter, business workflow는 이 계약을 소비하는 별도 시스템의 책임이다.

## 계약 구성 ^overview

| 계약 | 의미 | 구현 |
|---|---|---|
| `SourceRef` | source namespace + entity type + local ID + revision | `packages/federated-connection/src/contract.ts:SourceRef` |
| `SourceIdentifierRule` | source/entity별 local ID·revision 패턴과 규칙 버전 | `packages/federated-connection/src/contract.ts:SourceIdentifierRule` |
| `SourceIdentifierRegistry` | active 규칙 선택과 source lookup/snapshot 검증 | `packages/federated-connection/src/identifier-registry.ts:SourceIdentifierRegistry` |
| `ConnectionRef` | qa-sdk 연결 namespace + connection ID + version | `packages/federated-connection/src/contract.ts:ConnectionRef` |
| `ConnectionMapping` | source와 connection identity 사이의 상태·confidence·provenance | `packages/federated-connection/src/contract.ts:ConnectionMapping` |
| `TypedRelation` | source 또는 connection endpoint 사이의 의미 있는 관계 | `packages/federated-connection/src/contract.ts:TypedRelation` |
| `ConnectionRegistry` | in-memory mapping/relation 등록·resolve·snapshot | `packages/federated-connection/src/registry.ts:ConnectionRegistry` |
| `SourceAdapter` | source별 fetch 경계와 revisioned read-only snapshot 계약 | `packages/federated-connection/src/source-adapter.ts:SourceAdapter` |
| `SourceObservation` | revision/hash 비교로 created/updated/deleted/restored/unchanged 판정 | `packages/federated-connection/src/source-adapter.ts:observeSource` |

## 불변 조건 ^constraint

- source local ID와 connection ID를 같은 identity로 취급하지 않는다.
- source별 식별자 규칙은 `sourceSystem + entityType + version`으로 분리하며 다른 source profile에 암묵적으로 재사용하지 않는다.
- `active` 규칙만 관측 입력을 승인하고, 관측 시 선택된 규칙 ID/version을 운영 메타데이터에 고정한다.
- identifier rule 변경은 source local ID의 의미를 바꿀 수 있으므로 기존 plan에 소급 적용하지 않고 새 관측/plan에서 명시적으로 선택한다.
- source reference는 revision을 포함해야 하며, source가 독립적으로 진화할 수 있도록 값을 변경하지 않는다.
- 동일 source reference에 서로 다른 active target을 등록할 수 없다.
- `proposed`, `ambiguous`, `rejected`, `retired` mapping은 `resolved` 결과가 아니다.
- ambiguous mapping은 후보를 보존하고 자동으로 하나를 선택하지 않는다.
- relation은 빈 relation type을 허용하지 않으며, source/connection endpoint 종류를 명시한다.
- registry snapshot은 mapping/relation key 기준으로 결정론적으로 정렬된다.
- source snapshot은 source revision, observedAt, payloadHash를 보존하며 payload 전체를 registry에 저장하지 않는다.
- webhook/change event는 adapter fetch의 최종 상태를 대체하지 않으며, observation은 adapter가 반환한 snapshot을 기준으로 계산한다.
- registry는 persistence adapter가 아니며, 외부 저장소·원본 API·승인 시스템을 호출하지 않는다.

## 사용 흐름 ^workflow

```text
source adapter
  -> SourceSnapshot / SourceObservation
  -> SourceIdentifierRegistry.validate()
  -> SourceRef
  -> ConnectionRegistry.registerMapping()
  -> resolve() / mappingsForSource()
  -> TypedRelation
  -> snapshot()
  -> impact / verification consumer
```

mapping이 아직 확정되지 않은 경우 source adapter는 `proposed` 또는 `ambiguous` 상태를 기록하고, registry는 이를 자동 확정하지 않는다. 실행 adapter가 필요할 때는 snapshot과 source revision을 별도 precondition으로 사용한다.

### 다중 source 예시

ERP의 `customer:cust-7@rev-3`와 CRM의 `account:acct-42@snapshot-9`는 서로 다른 `SourceRef`다. 두 source가 같은 실제 party를 가리킨다는 mapping이 승인되면 둘 다 `ConnectionRef(qa, party-7, v1)`로 연결할 수 있지만, source key는 합쳐지지 않는다. 어느 한쪽의 mapping이 `ambiguous`이면 registry는 후보를 보존하고 두 source를 자동으로 같은 대상으로 확정하지 않는다.

## 책임 경계 ^context

- `definition-catalog`: definition vocabulary와 definition graph. connection identity/crosswalk는 소유하지 않는다.
- `dkg`: 설계·결정·제약 지식. source mapping의 SSOT가 아니다.
- `taxonomy-engine`: 유한 vocabulary와 변환 계약. source 간 mapping registry가 아니다.
- `federated-connection`: source/connection identity, source별 유한 identifier rule, mapping/relation 순수 계약 및 in-memory registry.
- `federated-connection-runtime`: connection state, impact plan, policy, approval, execute/re-fetch/verify orchestration.
- source-specific adapter: 각 원본 API/DB/SDK와 `SourceAdapter`를 구현하며 source authority와 fetch semantics를 소유한다.
- `spec-tracker`/`quality-ledger`/`review-ledger`: registry 결과를 검증 evidence로 소비할 수 있지만, mapping authority가 아니다.

## 검증 ^validation

```bash
corepack pnpm --filter federated-connection typecheck
corepack pnpm --filter federated-connection test
corepack pnpm --filter federated-connection build
corepack pnpm arch:surfaces
```
