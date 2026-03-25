---
def:
  id: spec-prop-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-prop-publish
      type: contains
    - target: spec-prop-notify
      type: contains
    - target: spec-prop-codegen
      type: contains
    - target: spec-prop-dkg-record
      type: contains
---

# Spec Propagation 시스템

## 목적 ^purpose

PrefixSpec 변경이 publish -> notify -> codegen -> DKG record로 종단 전파되는 파이프라인.

## 구성 ^overview

overview: 총 4개 멤버.
- `spec-prop-publish`: PrefixSpec을 RegistryService에 발행하는 1단계.
- `spec-prop-notify`: Registry 변경을 소비자 서비스에 전파하는 2단계.
- `spec-prop-codegen`: 변경된 스펙에서 TypeScript 타입을 자동 생성하는 3단계.
- `spec-prop-dkg-record`: 스펙 변경을 DKG 그래프에 기록하는 4단계.

기반: [core-types.md](../spec-engine/core-types.md) · [design-knowledge-graph.md](../spec-engine/design-knowledge-graph.md) · [dkg-skills.md](../spec-engine/dkg-skills.md) · [registry-service.spec.md](../services/registry-service.spec.md)

---

## 현재 조각과 끊어진 연결

### 있는 것

```
spec-core:
  PrefixSpec 타입 정의                    OK
  catalogToPrefixSpecs (CATALOG -> Spec)  OK (읽기 방향)
  codegen (PrefixSpec -> TS/Proto/JSON)   OK

registry-service:
  registerPrefix                          OK
  createDraft -> patchDraft -> lock       OK
  -> release -> activate -> deprecate     OK
  diffVersions (두 버전 비교)              OK
  resolveManifest (전체 active 버전 맵)    OK
  inspectMeta/Keys/Value (3단계 조회)      OK
  DAG 순회 (deps, reverseDeps, topoSort)  OK

decode-service:
  DecodeMap 번들 기반 독립 decode          OK

index-meta:
  PrefixRegistry (prefix DAG + capacity)  OK
  VersionLifecycleStore (draft->sealed)   OK
```

### 끊어진 연결 3개

```
  (1) PrefixSpec --?--> RegistryService
     spec-core에서 설계한 PrefixSpec을
     registry-service에 등록하는 경로가 없다.

  (2) RegistryService --?--> Consumer
     activate 후 소비자에게 알리는 메커니즘이 없다.
     (registry-service는 상태를 바꿀 뿐)

  (3) RegistryService --?--> Codegen
     활성화된 버전에서 코드를 자동 생성하는 연결이 없다.
     (codegen은 PrefixSpec 기반이지 registry 기반이 아님)
```

---

## 종단 파이프라인

### 전체 흐름

```
  PrefixSpec 작성
       │
       │ (1) publish
       ▼
  RegistryService
  (draft -> lock -> release -> activate)
       │
       ├─ (2) notify -> Consumer
       │     "permission:v5 활성화됨. 마이그레이션 필요 여부: ..."
       │
       ├─ (3) generate -> Codegen
       │     TS/Proto/JSON Schema 자동 생성
       │
       └─ (4) record -> DKG
              VersionEvent + Decision 기록
```

### Phase 구분

| Phase | 이름 | 설명 | 자동화 |
|---|---|---|---|
| **author** | 스펙 작성 | PrefixSpec 정의 (축, 차원, export surface) | 인간 |
| **publish** | 레지스트리 등록 | PrefixSpec -> registry-service에 draft 생성 | 자동 |
| **review** | 검토/검증 | diff, impact analysis, constraint check | 반자동 |
| **seal** | 고정 | lock -> release (sealed) | 자동 (명령) |
| **activate** | 활성화 | 이전 버전 deprecate + 새 버전 activate | 자동 (명령) |
| **propagate** | 전파 | notify + codegen + DKG record | 자동 |

## 구성 문서

| 문서 | 내용 |
|---|---|
| [spec-prop-publish.spec.md](spec-prop-publish.spec.md) | PrefixSpec을 RegistryService에 발행하는 1단계 |
| [spec-prop-notify.spec.md](spec-prop-notify.spec.md) | Registry 변경을 소비자 서비스에 전파하는 2단계 |
| [spec-prop-codegen.spec.md](spec-prop-codegen.spec.md) | 변경된 스펙에서 TypeScript 타입을 자동 생성하는 3단계 |
| [spec-prop-dkg-record.spec.md](spec-prop-dkg-record.spec.md) | 스펙 변경을 DKG 그래프에 기록하는 4단계 |

## 구현 위치

```
packages/spec-core/src/
  propagation/
    publish.ts              <- PrefixSpec -> RegistryService 등록
    notification.ts         <- VersionNotification 생성
    generate-from-registry.ts  <- registry -> codegen 연결
    record-to-dkg.ts        <- activate -> DKG VersionEvent 기록
    pipeline.ts             <- 종단 파이프라인 조합
```

registry-service에는 새 코드를 추가하지 않는다. 기존 API를 소비할 뿐이다.

### 의존 방향

```
propagation/ -> registry-service (RegistryService API 호출)
propagation/ -> dkg/ (GraphRegistry, skills 호출)
propagation/ -> codegen/ (buildIR, generateFromIR 호출)
propagation/ -> loader/ (PrefixSpec 타입)

registry-service -> propagation (역방향 금지)
```

## 불변식

1. **publishSpec은 draft만 생성한다.** seal/activate는 별도 명령이다. 자동으로 활성화하지 않는다.
2. **buildNotification은 알림을 생성할 뿐 전송하지 않는다.** 전송은 qa-sdk 트래커의 책임이다.
3. **generateFromRegistry는 active 버전만 대상으로 한다.** draft/released 상태의 codegen은 명시적으로 요청해야 한다.
4. **record-to-dkg는 VersionEvent만 자동 생성한다.** Decision은 인간이 작성한다 (scaffoldDecision으로 보조).
5. **propagation 모듈은 registry-service에 의존하지만 역방향 의존은 금지.** registry-service는 propagation을 모른다.
6. **종단 파이프라인의 각 단계는 독립 실행 가능하다.** publish만 하고 seal은 나중에, seal만 하고 activate는 나중에 할 수 있다.
