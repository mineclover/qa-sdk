---
def:
  tier: component
  id: gate-engine-decorator
  address: def_document:v2:68772
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-engine-core
      type: depends_on
sources:
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta/src/entry-flag-store.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/demo-tests/src/index-meta/gate-engine.test.ts
  - packages/demo-tests/src/index-meta/gate-engine-sql-e2e.test.ts
---
# GateEngine Decorator 패턴

## 목적 ^purpose

GateEngine decorator 패턴. release와 flexible flag 변경을 GateEngine 재계산에 연결하되, 실제 상태 계산은 GateEngine에 위임한다.

## 구성 ^overview

- **GateAwareVersionLifecycleStore**: inner store의 `release()` 성공 후 `recomputeOnRelease()`를 호출한다.
- **GateAwareEntryFlagStore**: inner store의 `setFlag()` 성공 후 version이 flexible이면 `recomputeOnFlagChange()`를 호출한다.
- **위임 경계**: release/setFlag 외의 store 메서드는 inner store에 위임한다.
- **계산 경계**: decorator는 재계산 트리거만 담당하고 DimStateSpec 계산/캐시 저장 로직에는 개입하지 않는다.

---

## Decorator 트리거

`GateAwareVersionLifecycleStore.release(prefix, versionId)`는 inner release가 성공한 뒤 leaf와 reverse-ref composite을 cascade 재계산한다.

`GateAwareEntryFlagStore.setFlag(record)`는 flag를 저장한 뒤 해당 version의 `deactivationMode`를 확인한다. strict mode면 재계산하지 않고, flexible mode면 cascade 재계산한다.

## DimStateSpec 계산

GateEngine은 dim별 상태를 외부에서 주입받아 recompute에 사용한다.

### 구조

```typescript
interface DimStateSpec {
  readonly dimIndex: number;
  readonly state: "inactive" | "open" | "reserved";
  readonly coords: string | null;
  readonly reason?: string;
}
```

### Decorator 확장 패턴

GateEngine은 PrefixRegistry, IndexMetaStore, EntryFlagStore에서 DimStateSpec을 구성한다.
Decorator는 이 구성을 직접 만들지 않고, release/setFlag 이벤트를 GateEngine 재계산 호출로 연결한다.

### 확장 사례

| 소스 | 처리 |
|------|------|
| VersionLifecycleStore | release 성공 후 GateEngine cascade 재계산 |
| EntryFlagStore | flexible mode에서 setFlag 성공 후 GateEngine cascade 재계산 |
| prefix_ref | GateEngine이 reverseRefs를 따라 composite까지 cascade 재계산 |

### 불변식

- inner store 작업이 실패하면 GateEngine 재계산은 실행되지 않는다
- strict mode의 setFlag는 저장만 하고 즉시 재계산하지 않는다
- flexible mode의 setFlag와 release는 leaf 변경을 composite까지 전파한다
- decorator는 trigger 역할만 담당하고 recompute 로직에 개입하지 않는다
