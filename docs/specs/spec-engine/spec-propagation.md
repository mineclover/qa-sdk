---
def:
  id: spec-propagation
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---

# Spec Propagation Pipeline — 스펙 작성 → 고정 → 전파

## 목적 ^purpose

PrefixSpec 작성에서 시작하여 registry-service에 고정하고, 소비자에게 전파하기까지의 종단 파이프라인을 정의한다.

기반: [core-types.md](core-types.md) · [design-knowledge-graph.md](design-knowledge-graph.md) · [dkg-skills.md](dkg-skills.md) · [../services/registry-service.spec.md](../services/registry-service.spec.md)

---

## 현재 조각과 끊어진 연결

### 있는 것

```
spec-core:
  PrefixSpec 타입 정의                    ✅
  catalogToPrefixSpecs (CATALOG → Spec)   ✅ (읽기 방향)
  codegen (PrefixSpec → TS/Proto/JSON)    ✅

registry-service:
  registerPrefix                          ✅
  createDraft → patchDraft → lock         ✅
  → release → activate → deprecate        ✅
  diffVersions (두 버전 비교)              ✅
  resolveManifest (전체 active 버전 맵)    ✅
  inspectMeta/Keys/Value (3단계 조회)      ✅
  DAG 순회 (deps, reverseDeps, topoSort)  ✅

decode-service:
  DecodeMap 번들 기반 독립 decode          ✅

index-meta:
  PrefixRegistry (prefix DAG + capacity)  ✅
  VersionLifecycleStore (draft→sealed)    ✅
```

### 끊어진 연결 3개

```
  ① PrefixSpec ──?──→ RegistryService
     spec-core에서 설계한 PrefixSpec을
     registry-service에 등록하는 경로가 없다.

  ② RegistryService ──?──→ Consumer
     activate 후 소비자에게 알리는 메커니즘이 없다.
     (registry-service는 상태를 바꿀 뿐)

  ③ RegistryService ──?──→ Codegen
     활성화된 버전에서 코드를 자동 생성하는 연결이 없다.
     (codegen은 PrefixSpec 기반이지 registry 기반이 아님)
```

---

## 종단 파이프라인

### 전체 흐름

```
  PrefixSpec 작성
       │
       │ ① publish
       ▼
  RegistryService
  (draft → lock → release → activate)
       │
       ├─ ② notify → Consumer
       │     "permission:v5 활성화됨. 마이그레이션 필요 여부: ..."
       │
       ├─ ③ generate → Codegen
       │     TS/Proto/JSON Schema 자동 생성
       │
       └─ ④ record → DKG
              VersionEvent + Decision 기록
```

### Phase 구분

| Phase | 이름 | 설명 | 자동화 |
|---|---|---|---|
| **author** | 스펙 작성 | PrefixSpec 정의 (축, 차원, export surface) | 인간 |
| **publish** | 레지스트리 등록 | PrefixSpec → registry-service에 draft 생성 | 자동 |
| **review** | 검토/검증 | diff, impact analysis, constraint check | 반자동 |
| **seal** | 고정 | lock → release (sealed) | 자동 (명령) |
| **activate** | 활성화 | 이전 버전 deprecate + 새 버전 activate | 자동 (명령) |
| **propagate** | 전파 | notify + codegen + DKG record | 자동 |

---

## ① publish — PrefixSpec → RegistryService

### 문제

spec-core의 PrefixSpec과 registry-service의 registerPrefix/createDraft는 다른 타입을 사용한다. 변환 레이어가 필요하다.

### API

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

### 변환 로직

```
PrefixSpec → RegistryService 매핑:

  PrefixSpec.id         → registerPrefix.prefix
  PrefixSpec.dims       → DimRef 분류:
    axis       → leaf prefix (자체 capacity)
    prefix_ref → composite ref (참조 prefix의 capacity를 곱함)
    table_ref  → 무시 (인코딩에서 제외)
  PrefixSpec.version    → createDraft.versionId
  PrefixSpec.export     → (registry에는 저장 안 함 — spec-core 영역)
  PrefixSpec.imports    → createDraft.refs 매핑
```

### 실행 순서

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

## ② notify — 소비자 전파

### 문제

registry-service의 activate는 상태를 바꿀 뿐, 누구에게도 알리지 않는다. 소비자가 능동적으로 폴링해야 한다.

### 설계 원칙

```
전파는 "알림 생성"과 "알림 전송"을 분리한다.

spec-propagation 파이프라인: 알림 내용을 생성한다 (순수 함수)
qa-sdk 트래커:             알림을 실제로 전송한다 (런타임)
```

### Notification 타입

```typescript
interface VersionNotification {
  /** 이벤트 유형 */
  event: "activated" | "deprecated" | "released";

  /** 대상 prefix + version */
  prefix: string;
  versionId: string;

  /** 이전 active version (있으면) */
  previousVersion?: string;

  /** 변경 요약 (diffVersions에서 파생) */
  summary: {
    capacityChanged: boolean;
    strideChanged: boolean;
    migrationRequired: boolean;
    addedDims: string[];
    removedDims: string[];
  };

  /** 영향받는 소비자 (DKG consumes에서 파생) */
  affectedConsumers: Array<{
    id: string;
    action: "update-recommended" | "migration-required" | "no-action";
  }>;

  /** 자동 생성된 마이그레이션 가이드 (있으면) */
  migrationGuide?: {
    pattern: string;          // inferMigrator 패턴
    autoMigratable: boolean;
    manualSteps?: string[];
  };

  /** 생성된 codegen 산출물 경로 (있으면) */
  codegenOutputs?: string[];
}
```

### 알림 생성 함수

```typescript
async function buildNotification(
  registryService: RegistryService,
  dkgGraph: GraphRegistry,
  prefix: string,
  versionId: string,
  event: "activated" | "deprecated" | "released",
): Promise<VersionNotification>;
```

### 실행 경로

```
buildNotification("permission", "v5", "activated"):

  1. 이전 active 버전 찾기:
     previousVersion = registryService.getActive("permission") 직전 상태

  2. diff 생성:
     registryService.diffVersions(previousVersion, versionId)
     → summary { capacityChanged, strideChanged, migrationRequired }

  3. DKG 소비자 조회:
     dkgGraph.reverseQuery("consumes", prefix)
     → affectedConsumers

  4. 각 소비자별 action 판정:
     migrationRequired → "migration-required"
     capacityChanged   → "update-recommended"
     else              → "no-action"

  5. migrationGuide 생성 (migrationRequired 시):
     inferMigrator(codec, prefix, previousVersion, versionId)
     → pattern, autoMigratable

  6. codegen 경로 수집 (generate 단계에서 생성된 경우)

  7. return VersionNotification
```

---

## ③ generate — Codegen 연결

### 문제

spec-core의 codegen은 PrefixSpec을 입력으로 받는다. registry-service에서 활성화된 버전의 정보를 codegen에 공급하는 경로가 없다.

### 연결 방식

```
registry-service → resolveManifest()
  → { versions: { permission: { versionId: "v5", shape, stride } } }
    → spec-core의 buildIR()에 공급
      → generateFromIR() (TS/Proto/JSON Schema)
```

### API

```typescript
interface GenerateFromRegistryInput {
  /** registry-service 인스턴스 */
  registryService: RegistryService;

  /** 생성할 출력 포맷 */
  formats: ("typescript" | "javascript" | "protobuf" | "json-schema")[];

  /** 출력 디렉토리 */
  outDir: string;

  /** 특정 prefix만 (없으면 전체 active) */
  prefixes?: string[];
}

interface GenerateFromRegistryResult {
  /** 생성된 파일 경로 */
  files: Array<{
    path: string;
    format: string;
    prefix: string;
  }>;

  /** 생성 기준 manifest */
  manifest: {
    versions: Record<string, any>;
    generatedAt: string;
  };
}

async function generateFromRegistry(
  input: GenerateFromRegistryInput,
): Promise<GenerateFromRegistryResult>;
```

### 실행 경로

```
generateFromRegistry({ registryService, formats: ["typescript"], outDir: "generated/" }):

  1. manifest = registryService.resolveManifest()

  2. for each prefix in manifest.versions:
     prefixSpec = registryToPrefixSpec(prefix, manifest)  // 역변환

  3. ir = buildIR({ axes, prefixSpecs })

  4. for each format:
     if "typescript": generateFromIR(ir) → write to outDir
     if "protobuf":   generateProtoFromIR(ir) → write to outDir
     ...

  5. return { files, manifest }
```

---

## ④ record — DKG 기록

activate 시 DKG에 자동 기록한다.

```
activate("permission", "v5"):

  1. VersionEvent.fromDiff:
     diff = registryService.diffVersions("v4", "v5")
     → VE-permission-v4-v5

  2. Decision (있으면):
     사전에 scaffoldDecision()으로 생성한 DEC-xxx 연결

  3. graph.addEdge("justifies", DEC-xxx, VE-permission-v4-v5)
```

dkg-skills.md에서 정의한 `versionEventFromDiff()`를 여기서 호출한다.

---

## 종단 시나리오

### 시나리오: 새 tracking prefix 추가

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
   → { prefix: "tracking", versionId: "v1", status: "draft", capacity: 48 }

3. review:
   analyzeImpact({ type: "new-prefix", target: { prefix: "tracking" } })
   → { strideBreak: false, affectedConsumers: [], constraintViolations: [] }
   → "새 prefix이므로 기존 시스템에 영향 없음"

4. seal:
   registry.lockDraft("tracking", "v1")
   registry.release("tracking", "v1")

5. activate:
   registry.activate("tracking", "v1")

6. propagate:
   buildNotification(registry, dkg, "tracking", "v1", "activated")
   → { event: "activated", affectedConsumers: [], migrationRequired: false }

   generateFromRegistry({ registry, formats: ["typescript"], outDir: "generated/" })
   → generated/tracking.ts

   versionEventFromDiff(diff, { date: "2026-03-20" })
   → VE-tracking-none-v1 (첫 버전)
```

### 시나리오: permission v4 → v5 (role capacity 확장)

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
   → { prefix: "permission", versionId: "v5", status: "draft", capacity: 64 }

3. review:
   analyzeImpact({ type: "capacity-changed", target: { prefix: "permission", from: "v4", to: "v5" } })
   → {
       strideBreak: false,
       migrationRequired: true (size 32→64),
       autoMigratable: true,
       affectedConsumers: [auth-service, payment-service],
     }

   constraintCheck("permission")
   → [] (위반 없음)

4. seal:
   registry.lockDraft("permission", "v5")
   registry.release("permission", "v5")

5. activate:
   registry.deprecate("permission", "v4")
   registry.activate("permission", "v5")

6. propagate:
   buildNotification(registry, dkg, "permission", "v5", "activated")
   → {
       event: "activated",
       previousVersion: "v4",
       summary: { capacityChanged: true, migrationRequired: true },
       affectedConsumers: [
         { id: "auth-service", action: "migration-required" },
         { id: "payment-service", action: "migration-required" },
       ],
       migrationGuide: { pattern: "identity", autoMigratable: true },
       codegenOutputs: ["generated/permission.ts"],
     }

   generateFromRegistry(...)
   → generated/permission.ts (v5 shape 반영)

   versionEventFromDiff(diff, { date: "2026-03-20" })
   → VE-permission-v4-v5 { changes: [{ kind: "capacity-changed", detail: "role max 8→16" }] }
```

---

## 구현 위치

```
packages/spec-core/src/
  propagation/
    publish.ts              ← PrefixSpec → RegistryService 등록
    notification.ts         ← VersionNotification 생성
    generate-from-registry.ts  ← registry → codegen 연결
    record-to-dkg.ts        ← activate → DKG VersionEvent 기록
    pipeline.ts             ← 종단 파이프라인 조합
```

registry-service에는 새 코드를 추가하지 않는다. 기존 API를 소비할 뿐이다.

### 의존 방향

```
propagation/ → registry-service (RegistryService API 호출)
propagation/ → dkg/ (GraphRegistry, skills 호출)
propagation/ → codegen/ (buildIR, generateFromIR 호출)
propagation/ → loader/ (PrefixSpec 타입)

registry-service → propagation (역방향 금지)
```

---

## 불변식

1. **publishSpec은 draft만 생성한다.** seal/activate는 별도 명령이다. 자동으로 활성화하지 않는다.
2. **buildNotification은 알림을 생성할 뿐 전송하지 않는다.** 전송은 qa-sdk 트래커의 책임이다.
3. **generateFromRegistry는 active 버전만 대상으로 한다.** draft/released 상태의 codegen은 명시적으로 요청해야 한다.
4. **record-to-dkg는 VersionEvent만 자동 생성한다.** Decision은 인간이 작성한다 (scaffoldDecision으로 보조).
5. **propagation 모듈은 registry-service에 의존하지만 역방향 의존은 금지.** registry-service는 propagation을 모른다.
6. **종단 파이프라인의 각 단계는 독립 실행 가능하다.** publish만 하고 seal은 나중에, seal만 하고 activate는 나중에 할 수 있다.
