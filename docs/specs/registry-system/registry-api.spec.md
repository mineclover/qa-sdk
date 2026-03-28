---
def:
  id: registry-api
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [tier-infra]
  links:
    - target: registry-data-model
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---
# Registry Service REST API

## 목적 ^purpose

Prefix 등록/조회, 버전 생성/전이, DAG 관계 질의, Catalog/설정/서비스/축 관리를 제공하는 REST 엔드포인트.

## 구성 ^overview

- **Prefix 관리** — POST/GET/PATCH/DELETE /prefixes. 등록, 목록, 상세, 패치, 삭제.
- **버전 라이프사이클** — draft → lock → release → activate → deprecate 전이 API.
- **DAG 질의** — 의존성/역참조 그래프 탐색 + 전체 DAG 시각화.
- **Catalog 관리** — CRUD + 설정(DkgConfig, PatternRules) + prefix 목록 조회.
- **서비스 토폴로지** — 서비스 등록/조회, svc-owners 맵, URL 맵, 게이트웨이 라우팅.
- **축 프로필** — 축별 capacity/version/entryCount 관리.
- **DecodeMap 공급** — decode-service에 디코딩 번들 공급.
- **이벤트 스키마** — event-catalog 기반 스키마 등록/조회.

## Prefix 관리

### POST /prefixes

새 prefix를 등록한다. `registerPrefixSchema` (zod)으로 검증.

### GET /prefixes

등록된 prefix 목록을 반환한다.

### GET /prefixes/:prefix

단일 prefix 상세 + versions 목록을 반환한다.

### PATCH /prefixes/:prefix

prefix 메타데이터를 패치한다 (name, category, meta, labels).
- category 변경 시 유효값 경고 (blocking 하지 않음)
- 유효 카테고리: entity, event, relation, state, policy, observation

### DELETE /prefixes/:prefix

prefix를 삭제한다.

## 버전 라이프사이클

| 엔드포인트 | 전이 | 설명 |
|:---|:---|:---|
| `POST /prefixes/:prefix/versions` | → draft | 새 draft 버전 생성 |
| `GET /prefixes/:prefix/versions` | - | 버전 목록 (status 필터) |
| `GET /prefixes/:prefix/versions/:id` | - | 단건 조회 |
| `PATCH /prefixes/:prefix/versions/:id` | - | draft 패치 |
| `POST /.../:id/lock` | draft → locked | draft 잠금 (수정 불가) |
| `POST /.../:id/unlock` | locked → draft | draft 잠금 해제 |
| `POST /.../:id/release` | locked → released | 배포 준비 완료 |
| `POST /.../:id/activate` | released → active | 활성화 (운영 적용) |
| `POST /.../:id/deprecate` | active → deprecated | 비활성화 |

### Activation Gate (선택적)

`CONSTRAINT_GATE_ENABLED=true` 시 활성화 전에 DKG 기반 제약 검사:
- `checkActivationReadiness(graph, prefixId, opts)` 호출
- 모드: `CONSTRAINT_GATE_MODE` (strict / warn)

### Post-Activation Hook (선택적)

`POST_ACTIVATION_HOOK_ENABLED=true` 시 활성화 후 DKG VersionEvent 기록.

## DAG 질의

| 엔드포인트 | 설명 |
|:---|:---|
| `GET /dag/:prefix/:versionId/deps` | 직접 의존성 목록 |
| `GET /dag/:prefix/:versionId/deps/transitive` | 전이적 의존성 (전체 깊이) |
| `GET /dag/:prefix/:versionId/reverse-refs` | 역참조 목록 (이 prefix를 참조하는 prefix) |
| `GET /dag/graph` | 전체 DAG 그래프 (시각화용) |

## Catalog 관리

| 엔드포인트 | 설명 |
|:---|:---|
| `POST /catalogs` | 카탈로그 등록 (id, name, data) |
| `GET /catalogs` | 카탈로그 목록 (id, name, updatedAt) |
| `GET /catalogs/:id` | 단건 조회 (data 포함) |
| `PUT /catalogs/:id` | 카탈로그 업데이트 |
| `DELETE /catalogs/:id` | 카탈로그 삭제 |
| `GET /catalogs/:id/prefixes` | 카탈로그 내 prefix 목록 |
| `GET /catalogs/:id/config` | DkgConfig 조회 |
| `PUT /catalogs/:id/config` | DkgConfig 저장/업데이트 |
| `GET /catalogs/:id/pattern-rules` | PatternRules 조회 |
| `PUT /catalogs/:id/pattern-rules` | PatternRules 저장/업데이트 |
| `GET /catalogs/:id/configs` | 모든 설정 타입 목록 |

## 서비스 토폴로지

| 엔드포인트 | 설명 |
|:---|:---|
| `GET /api/services` | 전체 서비스 목록 (catalog 쿼리) |
| `GET /api/services/:id` | 단건 조회 |
| `POST /api/services` | 단건 추가/업데이트 |
| `PUT /api/services` | 전체 목록 교체 |
| `DELETE /api/services/:id` | 단건 삭제 |
| `GET /api/services/svc-owners` | prefix → serviceId 매핑 (Projection용) |
| `GET /api/services/urls` | 서비스별 URL 맵 (?env=dev/prod) |
| `GET /api/services/gateway` | 게이트웨이 라우팅 구성 (path, url, strip) |

## DecodeMap 공급

| 엔드포인트 | 설명 |
|:---|:---|
| `GET /api/decode-map` | 전체 prefix의 DecodeMap 목록 |
| `GET /api/decode-map/:prefix/:version` | 단건 DecodeMap |

decode-service가 startup 시 이 API를 호출하여 디코더를 로드한다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `3300` | 서비스 포트 |
| `SQLITE_PATH` | `:memory:` | SQLite 경로 (`:memory:`면 InMemory 스토어) |
| `CORS_ORIGIN` | `*` | CORS 허용 origin |
| `CONSTRAINT_GATE_ENABLED` | `false` | DKG 활성화 게이트 |
| `CONSTRAINT_GATE_MODE` | - | strict / warn |
| `POST_ACTIVATION_HOOK_ENABLED` | `false` | 활성화 후 DKG 기록 hook |
| `DEV_DASHBOARD_ENABLED` | `false` | 개발 대시보드 (WebSocket) |

## Startup Seed

서비스 시작 시 다음을 자동 seed:

1. `DEMO_CATALOG` — 해시 비교 후 변경 시 자동 업데이트 (auto-reseed)
2. `DEMO_DKG_CONFIG` — DKG 설정
3. `DEMO_PATTERN_RULES` — 패턴 규칙
4. 서비스 목록 (18개 서비스: 프론트엔드/백엔드/인프라/시스템/모니터링)
5. 서비스 엔드포인트 (dev/prod 환경별 URL)
6. 이벤트 스키마 (event-catalog의 core events + prefix-mapping events)
7. 축 프로필 (catalog 기준)
