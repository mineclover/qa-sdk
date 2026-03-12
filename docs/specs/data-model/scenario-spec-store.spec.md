# ScenarioSpec + ScenarioSpecStore

> 검증 완료된 `ScenarioSpec` 문서를 저장하고 조회하는 core 포트 계약.

## 상태

implemented

## ScenarioSpec 타입

```typescript
interface ScenarioSpec {
  scenario_id: string;
  version: string;
  domain: string;
  description?: string;
  entry_conditions?: EntryCondition[];
  steps: ScenarioStep[];
}
```

## ScenarioSpecStore 포트

```typescript
interface ScenarioSpecStore {
  upsert(spec: ScenarioSpec): Promise<void>;
  findById(scenarioId: string): Promise<ScenarioSpec | null>;
  findAll(limit?: number): Promise<ScenarioSpec[]>;
  findByDomain(domain: string, limit?: number): Promise<ScenarioSpec[]>;
  remove(scenarioId: string): Promise<boolean>;
}
```

## 동작

### upsert

- `spec.scenario_id`를 key로 저장한다.
- 동일 `scenario_id`가 이미 있으면 전체 `ScenarioSpec` 문서를 새 값으로 덮어쓴다.
- partial patch는 지원하지 않는다. `version`, `domain`, `description`, `steps`를 포함한 전체 spec을 다시 전달해야 한다.
- schema validation 및 의미 검증(`compileSpec`)은 상위 계층에서 끝난 뒤 호출하는 것을 전제로 한다.

### findById

- `scenarioId`와 일치하는 단일 spec을 반환한다.
- 없으면 `null`을 반환한다.

### findAll

- 저장된 모든 `ScenarioSpec`을 반환한다.
- `limit`가 주어지면 최대 `limit`개까지만 반환한다.
- 반환 순서는 포트 계약상 보장하지 않는다. 정렬이 필요하면 호출자가 후처리한다.

### findByDomain

- `spec.domain === domain`인 spec만 반환한다.
- `limit`가 주어지면 필터링 결과에서 최대 `limit`개까지만 반환한다.
- 반환 순서는 포트 계약상 보장하지 않는다.

### remove

- `scenarioId`에 해당하는 spec을 삭제한다.
- 실제로 삭제된 항목이 있으면 `true`, 없으면 `false`를 반환한다.

## 제약 조건

- `scenario_id`는 저장소 내에서 유일해야 한다.
- 저장소는 `ScenarioSpec` 전체 문서를 보존한다. 개별 step/field 단위 갱신 API는 제공하지 않는다.
- 어댑터는 저장된 객체의 참조를 외부에 그대로 노출하지 않아야 한다. 호출자가 반환값을 수정해도 저장본이 오염되면 안 된다.
