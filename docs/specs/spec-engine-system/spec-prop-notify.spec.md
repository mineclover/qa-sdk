---
def:
  id: spec-prop-notify
  address: def_document:v2:137367
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: []
  links:
    - target: spec-prop-publish
      type: refines
    - target: spec-prop-codegen
      type: refines
---

# Spec Propagation — 2단계: Notify

## 목적 ^purpose

Registry 변경을 소비자 서비스에 전파하는 2단계. 웹훅/이벤트 기반 알림.

## 구성 ^overview

- **설계 분리**: "알림 생성"(spec-propagation, 순수 함수)과 "알림 전송"(qa-sdk 트래커, 런타임)을 분리
- **VersionNotification 타입**: event 유형(activated/deprecated/released), 대상 prefix+version, 변경 요약, 영향받는 소비자, 마이그레이션 가이드 포함
- **buildNotification 함수**: registryService와 dkgGraph를 입력받아 diff 생성 → 소비자 조회 → action 판정 → 알림 객체 구성
- **소비자별 action 판정**: migrationRequired → "migration-required", capacityChanged → "update-recommended", 그 외 → "no-action"
- **마이그레이션 가이드**: migrationRequired 시 inferMigrator로 패턴 추론 및 autoMigratable 여부 판정
- **DKG 연동**: dkgGraph.reverseQuery("consumes", prefix)로 영향받는 소비자 서비스를 자동 조회

---

## 문제

registry-service의 activate는 상태를 바꿀 뿐, 누구에게도 알리지 않는다. 소비자가 능동적으로 폴링해야 한다.

---

## 설계 원칙

```
전파는 "알림 생성"과 "알림 전송"을 분리한다.

spec-propagation 파이프라인: 알림 내용을 생성한다 (순수 함수)
qa-sdk 트래커:             알림을 실제로 전송한다 (런타임)
```

---

## Notification 타입

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

---

## 알림 생성 함수

```typescript
async function buildNotification(
  registryService: RegistryService,
  dkgGraph: GraphRegistry,
  prefix: string,
  versionId: string,
  event: "activated" | "deprecated" | "released",
): Promise<VersionNotification>;
```

---

## 실행 경로

```
buildNotification("permission", "v5", "activated"):

  1. 이전 active 버전 찾기:
     previousVersion = registryService.getActive("permission") 직전 상태

  2. diff 생성:
     registryService.diffVersions(previousVersion, versionId)
     -> summary { capacityChanged, strideChanged, migrationRequired }

  3. DKG 소비자 조회:
     dkgGraph.reverseQuery("consumes", prefix)
     -> affectedConsumers

  4. 각 소비자별 action 판정:
     migrationRequired -> "migration-required"
     capacityChanged   -> "update-recommended"
     else              -> "no-action"

  5. migrationGuide 생성 (migrationRequired 시):
     inferMigrator(codec, prefix, previousVersion, versionId)
     -> pattern, autoMigratable

  6. codegen 경로 수집 (generate 단계에서 생성된 경우)

  7. return VersionNotification
```

---

## 종단 시나리오: permission v5 활성화 알림

```
buildNotification(registry, dkg, "permission", "v5", "activated")
-> {
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
```
