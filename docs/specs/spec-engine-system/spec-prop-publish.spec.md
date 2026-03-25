---
def:
  id: spec-prop-publish
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-core-types
      type: depends_on
    - target: registry-data-model
      type: depends_on
---

# Spec Propagation — 1단계: Publish

## 목적 ^purpose

PrefixSpec을 RegistryService에 발행하는 1단계. 스키마 검증 + 버전 생성.

---

## 문제

spec-core의 PrefixSpec과 registry-service의 registerPrefix/createDraft는 다른 타입을 사용한다. 변환 레이어가 필요하다.

---

## API

```typescript
interface PublishInput {
  /** PrefixSpec (spec-core에서 정의) */
  spec: PrefixSpec;

  /** prefix 소유자 */
  owner: string;

  /** 기존 prefix의 새 버전인가, 완전히 새 prefix인가 */
  mode: "new" | "version";

  /** version 모드일 때 기반 버전 */
  baseVersion?: string;
}

interface PublishResult {
  prefix: string;
  versionId: string;
  status: "draft";

  /** spec에서 추론한 capacity */
  capacity: number;

  /** spec에서 추론한 refs */
  refs: Array<{ prefix: string; versionId: string }>;
}

async function publishSpec(
  registryService: RegistryService,
  input: PublishInput,
): Promise<PublishResult>;
```

---

## 변환 로직

```
PrefixSpec -> RegistryService 매핑:

  PrefixSpec.id         -> registerPrefix.prefix
  PrefixSpec.dims       -> DimRef 분류:
    axis       -> leaf prefix (자체 capacity)
    prefix_ref -> composite ref (참조 prefix의 capacity를 곱함)
    table_ref  -> 무시 (인코딩에서 제외)
  PrefixSpec.version    -> createDraft.versionId
  PrefixSpec.export     -> (registry에는 저장 안 함 — spec-core 영역)
  PrefixSpec.imports    -> createDraft.refs 매핑
```

---

## 실행 순서

```
publishSpec(registryService, { spec, owner, mode: "new" }):

  1. mode === "new":
     registryService.registerPrefix({
       prefix: spec.id,
       owner,
       kind: hasRefs(spec) ? "composite" : "leaf",
       numberType: "number",
     })

  2. refs 구성:
     for each dim in spec.dims where kind === "prefix_ref":
       refs.push({ prefix: dim.prefixId, versionId: resolveActiveVersion(dim.prefixId) })

  3. capacity 계산:
     leaf dims의 capacity 곱 (axis dims에서 shape 추출)

  4. registryService.createDraft({
       prefix: spec.id,
       versionId: spec.version,
       baseVersionId: null,
       capacity,
       refs,
     })

  5. return { prefix, versionId, status: "draft", capacity, refs }
```

---

## 종단 시나리오: 새 tracking prefix 추가

```
1. author:
   const trackingSpec: PrefixSpec = {
     id: "tracking",
     version: "v1",
     dims: {
       trackAction: { kind: "axis", axisId: "trackAction" },
       page: { kind: "axis", axisId: "page" },
       userType: { kind: "axis", axisId: "userType" },
     },
     export: { dims: ["trackAction", "page", "userType"], pattern: "{trackAction}.{page}.{userType}" },
   };

2. publish:
   publishSpec(registry, {
     spec: trackingSpec,
     owner: "tracking-team",
     mode: "new",
   })
   -> { prefix: "tracking", versionId: "v1", status: "draft", capacity: 48 }

3. review:
   analyzeImpact({ type: "new-prefix", target: { prefix: "tracking" } })
   -> { strideBreak: false, affectedConsumers: [], constraintViolations: [] }
   -> "새 prefix이므로 기존 시스템에 영향 없음"

4. seal:
   registry.lockDraft("tracking", "v1")
   registry.release("tracking", "v1")

5. activate:
   registry.activate("tracking", "v1")
```

---

## 종단 시나리오: permission v4 -> v5 (role capacity 확장)

```
1. author:
   기존 permission PrefixSpec의 version을 "v5"로, role axis를 v5로 핀

2. publish:
   publishSpec(registry, {
     spec: updatedPermissionSpec,
     owner: "auth-team",
     mode: "version",
     baseVersion: "v4",
   })
   -> { prefix: "permission", versionId: "v5", status: "draft", capacity: 64 }

3. review:
   analyzeImpact({ type: "capacity-changed", target: { prefix: "permission", from: "v4", to: "v5" } })
   -> {
       strideBreak: false,
       migrationRequired: true (size 32->64),
       autoMigratable: true,
       affectedConsumers: [auth-service, payment-service],
     }

   constraintCheck("permission")
   -> [] (위반 없음)

4. seal:
   registry.lockDraft("permission", "v5")
   registry.release("permission", "v5")

5. activate:
   registry.deprecate("permission", "v4")
   registry.activate("permission", "v5")
```
