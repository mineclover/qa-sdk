# Realization Plan: Registry 연결

> Status: planning
> DKG-Ref: (작성 후 등록)
> Created: 2026-03-21
> Last verified: —

## 1. 배경

registry-service에 완전한 버전 관리 파이프라인이 구현되어 있다 (draft→lock→release→activate, shape/stride/capacity 저장). 하지만 demo-catalog.ts에서 직접 import하는 경로만 사용 중이라 registry와 연결이 안 됨.

### 있는 조각

| 조각 | 위치 | 역할 |
|------|------|------|
| DEMO_CATALOG | demo-snapshot/demo-catalog.ts | 축/prefix/shape/capacity 코드 SSOT |
| catalogToPrefixSpecs | spec-core/loader/catalog-bridge.ts | catalog → PrefixSpec[] 변환 |
| RegistryPort | spec-core/propagation/registry-port.ts | 추상 인터페이스 (register, lock, release, activate) |
| InMemoryRegistry | spec-core/propagation/registry-port.ts | 테스트용 구현 |
| RegistryHttpClient | spec-core/propagation/registry-http-client.ts | HTTP 클라이언트 (localhost:3100) |
| registry-service | registry-service/ | Hono 서버 (prefix, version, catalog CRUD) |
| schema/import | registry-service/routes/schema.ts | SchemaSnapshot → prefix+version draft 자동 등록 |
| version lifecycle | registry-service/routes/version.ts | lock, unlock, release, activate, deprecate |
| qa-sdk register | cli/commands/register.ts | SchemaSnapshot → registry POST /schema/import |
| propagation | spec-core/propagation/ | publishSpec, seal, activateAndPropagate |

### 연결 안 된 것

| # | Gap | 현상 |
|---|-----|------|
| C1 | catalog → SchemaSnapshot 변환 없음 | scan git은 git 메타데이터용. DEMO_CATALOG에서 SchemaSnapshot을 생성하는 경로 없음 |
| C2 | CLI에서 lifecycle 전이 없음 | register는 import만 함. lock/release/activate CLI 명령 없음 |
| C3 | 소비자 조회 경로 없음 | 모든 소비자가 `import { DEMO_CATALOG } from "demo-snapshot"` 직접 사용. registry active version 미사용 |

## 2. 설계

### Phase A: catalog → SchemaSnapshot 변환

DEMO_CATALOG에서 registry-service가 소비할 수 있는 SchemaSnapshot을 생성한다.

#### A-1: catalogToSnapshot 함수

- What: `catalogToSnapshot(catalog: DemoCatalog): SchemaSnapshot` — 축/prefix를 SchemaSnapshot 형식으로 변환
- Where: spec-core/loader/catalog-bridge.ts (기존 catalogToPrefixSpecs 옆에)
- Verify: `catalogToSnapshot(DEMO_CATALOG)` → 유효한 SchemaSnapshot

#### A-2: CLI 명령 `dkg publish`

- What: `qa-sdk dkg publish [--registry <url>]` — DEMO_CATALOG → SchemaSnapshot → registry-service import
- Where: cli/commands/dkg.ts
- Verify: `qa-sdk dkg publish --registry http://localhost:3100`

### Phase B: lifecycle 전이 CLI

registry에 등록된 draft를 lifecycle 전이한다.

#### B-1: `dkg version` CLI 명령군

```
qa-sdk dkg version list <prefix>              — 버전 목록
qa-sdk dkg version lock <prefix> <versionId>  — draft → locked
qa-sdk dkg version release <prefix> <versionId> — locked → released
qa-sdk dkg version activate <prefix> <versionId> — released → active
```

- Where: cli/commands/dkg.ts
- Uses: RegistryHttpClient (기존 구현)

### Phase C: 소비자 조회 경로

registry에서 active version을 조회하여 사용하는 경로.

#### C-1: registry에서 active catalog 조회

- What: CLI 시작 시 `--registry` 옵션이 있으면 registry에서 active version 기반 catalog을 로드
- Where: cli/catalog-loader.ts (이미 존재)
- 이것은 demo-catalog.ts 직접 import를 대체하는 게 아니라 **대안 경로**를 추가하는 것

## 3. Fitness Criteria

| # | 기준 | Verify |
|---|------|--------|
| F1 | `catalogToSnapshot(DEMO_CATALOG)`이 유효한 SchemaSnapshot 반환 | 단위 테스트 |
| F2 | `dkg publish` 후 registry-service에 prefix/version이 등록됨 | `curl localhost:3100/prefixes` |
| F3 | `dkg version activate`로 version이 active 상태가 됨 | `curl localhost:3100/prefixes/permission/versions?status=active` |
| F4 | shape/stride/capacity가 registry DB에 저장됨 | `curl localhost:3100/prefixes/permission/versions/v1` |

## 4. 우선순위

Phase A가 핵심. catalog → SchemaSnapshot 변환이 있으면 기존 `qa-sdk register`를 그대로 사용 가능.

Phase B는 편의 CLI. RegistryHttpClient가 이미 모든 메서드를 구현하고 있으므로 thin wrapper.

Phase C는 가장 나중. 현재 코드 직접 import가 잘 작동하고 있고, registry 경로는 복수 환경이 필요할 때.

## 5. 되돌림 조건

- registry-service가 불안정하면 → demo-catalog.ts 직접 import로 즉시 복귀 (기존 경로 유지)
- SchemaSnapshot 변환이 정보를 손실하면 → 변환 단위 테스트 강화
- 이중 SSOT 문제 → catalog 코드를 항상 canonical로 유지, registry는 배포 채널로만 사용
