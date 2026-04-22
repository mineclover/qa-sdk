# Authorization Model — 구현 대기 Backlog

권한 모델 스펙 작업(2026-04 세션) 이후 **스펙은 작성됐지만 아직 구현되지 않은 항목들**의 컨텍스트 정리. 각 항목은 별도 세션에서 독립적으로 착수 가능하도록 진입점·의존·트리거·리스크를 담았다.

---

## 0. 현재 구현 스택 (기준선)

이 backlog를 읽기 전 현재 뭐가 있는지 알아야 한다. 2026-04 세션 커밋 체인 기준:

```
Layer 1: DisjointUnionIndex                    ✅ packages/weighted-index/src/vocab/union-index.ts
Layer 2: ResourcePolicyRegistry FSM            ✅ packages/permission-engine/src/resource-policy/
         + Drizzle/SQLite adapter              ✅ packages/resource-policy-store/
Layer 3: VersionedBitmap (issue/verify)        ✅ packages/permission-engine/src/versioned-bitmap/
Layer 4: AuditRecorder (InMemory)              ✅ packages/permission-engine/src/audit/
Layer 5: AccessChecker (2-pass)                ✅ packages/permission-engine/src/access-checker/
E2E 통합 테스트                                ✅ packages/resource-policy-store/src/e2e-integration.test.ts
```

**핵심 스펙:**
- `docs/specs/authorization-ontology/authorization-ontology-resource-lifecycle.spec.md`
- `docs/specs/authorization-ontology/authorization-ontology-bitmap-pipeline.spec.md`
- `docs/specs/authorization-ontology/authorization-ontology-nested-audit-tracing.spec.md`
- `docs/specs/authorization-ontology/authorization-ontology-rls-enforcement.spec.md`
- `docs/specs/weighted-index-system/wi-disjoint-union-addressing.spec.md`
- `docs/specs/system/coordinate-storage.rule.md`

**합의된 설계 결정:**
- `Unified versioning` — DisjointUnionIndex variant 전체를 단일 version으로 관리 (bitmap-pipeline §6)
- `target_kind`는 sum type (곱셈이 아닌 합산 — 공간 효율)
- `transaction endpoint도 API` — 별도 권한 레이어 없이 Pass 1 bitmap의 variant
- `Nested audit은 OTEL span_id 재사용` — 별도 ID 체계 없음
- `Pass 2 역전이 금지` — 접근 범위 축소는 policy 변경으로

---

## 1. Audit DB 어댑터 + OTEL wrapper

**우선순위**: 최우선 (프로덕션 전환에 필수)

### 현재 상태

- `InMemoryAuditRecorder` (단일 프로세스, 휘발성) ✅
- 스펙: `authorization-ontology-nested-audit-tracing.spec.md`

### 미구현

- **DB 영속 AuditRecorder**: `audit_entries` 테이블 + Drizzle 어댑터
- **OTEL wrapper**: span context에서 `traceId/spanId/parentSpanId` 자동 주입
- **Trace explorer UI**: `authorization-monitor-web` 페이지
- **Retention 배치**: hot(30d) / warm(90d execution only) / cold(1y) 전이

### 구현 단위

1. **Phase 1** — DrizzleAuditRecorder
   - 신규 패키지: `packages/audit-recorder-store/` (이름은 `resource-policy-store` 컨벤션 따름)
   - 스키마: 스펙 §1 (audit_entries 테이블 + 5 인덱스)
   - 인터페이스 준수: `AuditRecorder` (from permission-engine)
   - 테스트: InMemory 테스트 스위트 재활용 (동일 계약)

2. **Phase 2** — OTEL wrapper
   - 위치 후보: `packages/permission-engine/src/audit/otel-wrapper.ts`
   - `@qa-sdk/otel`에 peerDep 추가
   - 현재 `newSpanId: () => string` 콜백을 OTEL context에서 자동 추출
   - AccessChecker 진입 시 active span 획득 → parentSpanId로 사용

3. **Phase 3** — 배치·UI
   - Retention archiver (scheduled task)
   - trace explorer (viz-web 또는 monitor-web)

### 진입점

- 시작 파일: `packages/audit-recorder-store/src/schema.ts` (resource-policy-store 복제)
- 스키마 참고: `authorization-ontology-nested-audit-tracing.spec.md` §1

### 의존

- `@qa-sdk/otel` (Phase 2)
- `permission-engine` 인터페이스 이미 export

### 트리거

**언제 시작**: 관측 인프라를 실제로 붙일 때. 또는 테스트 환경에서 인프로세스 debug가 부족해지는 순간.

### 리스크

- **Check entry 폭발**: 고빈도 API에서 매 check = entry 1개 → 쓰기 비용 큼. 샘플링·aggregate 전략 필요 (deny/error만 저장)
- **OTEL context 누락**: cron job·내부 이벤트 핸들러에서 context 없으면 root가 여럿 생성. 수동 startExecution root 정책 필요
- **Privacy**: target_id에 PII 들어갈 수 있음. scrubbing 훅 설계 필수

---

## 2. Bitmap Pipeline — 분배·무효화

**우선순위**: 높음 (실제 유저 권한 변경 반영 필수)

### 현재 상태

- `issueBitmap` / `verifyBitmap` (HMAC + TTL + dual-accept rotation) ✅
- `VersionedBitmap` 타입 + 테스트 9건 ✅
- 스펙: `authorization-ontology-bitmap-pipeline.spec.md`

### 미구현

- **Refresh endpoint**: expiresAt 임박 시 background 재발급
- **Pub/sub invalidation**: 권한 변경 이벤트 → 모든 서버 L1 LRU flush
- **JWT embed vs Redis reference**: 8KB threshold 자동 분기
- **HMAC secret rotation 자동화**: 90일 주기 + 24h dual-accept
- **`computeUserBits` 구현**: 실제 user의 role·override·inheritance 해석

### 구현 단위

1. **`BitmapIssuer` 서비스**
   - 위치 후보: `packages/permission-engine/src/versioned-bitmap/issuer-service.ts`
   - `computeUserBits(userId, prefix, v)` — DB/Cerbos 조회 후 bit 집합
   - Redis 캐시 레이어 (`userId:prefix:v` 키)
   - 의존: `role-registry`, `org-role-registry` (이미 존재)

2. **HTTP refresh endpoint**
   - 새 서비스 또는 기존 auth service에 endpoint
   - 클라이언트: expiresAt - 20% 도달 시 호출

3. **Invalidation pub/sub**
   - Redis pub/sub 채널: `bitmap:invalidate`
   - scope: `user | role | prefix`
   - 각 서버의 LRU cache가 listener 등록

4. **Secret rotation 파이프라인**
   - scheduled job (cron): 90일마다 새 secret 발급
   - dual-accept 24h 동안 구·신 모두 허용 (verifyBitmap.previousSecrets)
   - KID(Key ID)를 VersionedBitmap 메타에 추가하는 방안 검토

### 진입점

- 시작 파일: `packages/permission-engine/src/versioned-bitmap/issuer-service.ts`
- 스펙: `authorization-ontology-bitmap-pipeline.spec.md` §2-5

### 의존

- Redis (프로덕션) 또는 ioredis 라이브러리
- `role-registry`, `org-role-registry` (already in permission-engine)
- HTTP 프레임워크 (hono 또는 nestjs — ingest-server 등 참조)

### 트리거

**언제 시작**: 실제 유저 로그인·권한 변경이 있는 auth service를 붙일 때. 또는 현 in-memory 테스트만으로는 실전 검증이 부족해지는 시점.

### 리스크

- **freshness ≠ 0**: pub/sub 전파 + 캐시 TTL 만큼 지연. 중요한 거절은 Cerbos로 double-check 정책 필요
- **JWT size inflation**: bitmap이 커지면 매 요청 payload 증가. Redis reference 패턴 강제 시점 결정 필요
- **Secret rotation 누락**: 자동화 실패 시 장기 유효 bitmap 리스크. 알림·감사 필수
- **권한 변경 이벤트 누락**: role definition 변경이 pub/sub 트리거를 놓치면 정합성 구멍. audit-layer에서 주기 감사

---

## 3. RLS Enforcement (PostgreSQL)

**우선순위**: 중간 (SQLite → PG 이행 시점에 상향)

### 현재 상태

- 스펙: `authorization-ontology-rls-enforcement.spec.md` (전체 5-phase 계획)
- 현재 qa-sdk는 SQLite + D1 사용 중 → 적용 대상 없음

### 미구현

- `auth` schema + helper 함수 (`current_user_id`, `has_bit`, `resource_state`)
- 보호 대상 테이블별 정책 템플릿
- Session context 주입 middleware (`SET LOCAL`)
- Shadow mode → enforce 단계적 전환
- Admin bypass (별도 PG role + 감사)

### 구현 단위

1. **Phase 1 — Helper functions + 스키마**
   - PG migration 스크립트
   - `auth.has_bit(pos INT)` / `auth.current_user_id()` / `auth.resource_state(rid)`
   - `resource_policies` 테이블 선행 (이미 Drizzle 스키마 있음)

2. **Phase 2 — 보호 대상 식별**
   - 권한 경계 테이블 목록 작성
   - 각 테이블별 정책 템플릿 생성

3. **Phase 3 — Application 레이어 통합**
   - Drizzle middleware 또는 connection hook으로 `SET LOCAL` 자동 주입
   - bitmap serialize (bytea)

4. **Phase 4 — Shadow mode**
   - 정책 활성화, 차단 안 하고 로그만
   - false positive 분석

5. **Phase 5 — Enforce**
   - `FORCE ROW LEVEL SECURITY`
   - admin bypass 연결만 예외

### 진입점

- 시작 파일: PG migration (`packages/<service>/drizzle/XXXX_auth_helpers.sql`)
- 스펙: `authorization-ontology-rls-enforcement.spec.md` §3-5

### 의존

- PostgreSQL 이행 완료 (현재 SQLite/D1 → PG)
- `resource-policy-store`의 PG 버전 (SQLite 버전은 이미 있음)

### 트리거

**언제 시작**: 프로덕션 DB가 PG로 이행하거나, DB 직접 접근 감사에서 bypass 사례가 발견될 때.

### 리스크

- **REGISTERED/DELEGATED는 RLS 안 하기로 결정** (스펙 §3) — 복잡한 정책 판정은 API 레이어에만. DB 직접 접근자는 보수적으로 UNREGISTERED만 허용.
- **SET LOCAL 누락**: connection 재사용 시 이전 context 유출 가능. pool hook 확실히
- **bitmap 크기**: bytea 컬럼으로 session 주입. 128KB 넘으면 부담. 압축·샤딩 검토
- **Admin bypass 감사**: 별도 PG role + pgAudit 필수. 미설정 시 규칙 무효화

---

## 4. Ingest Audit — P1~P3 Backlog

**우선순위**: 조건부 (shape 변경 계획 수립 시에만)

### 현재 상태

- 감사 문서: `docs/proposals/ingest-coordinate-storage-audit/README.md`
- 분류 완료: event_records (범주 B), key_observations (범주 A 미확인)

### 미구현 (P1~P3)

#### P1. `key_observations` version 컬럼 분리

- **이유**: 범주 A(packed address)인데 version 포함 여부 불명
- **작업**:
  1. `packed_key` 포맷 분석 (실제 인코딩 확인)
  2. 미포함이면 별도 `version TEXT` 컬럼 추가
  3. PK를 `(prefix_id, version, packed_key)`로 확장
  4. 기존 데이터 마이그레이션
- **진입점**: `packages/ingest-server/src/stores/d1-key-observation-store.ts`

#### P2. `address_context` JSON 스키마 계약화

- **이유**: 범주 B(JSON)인데 version 포함 암묵적
- **작업**:
  1. JSON 타입 정의 (`AddressContextV1` 같은 공식 타입)
  2. 생산 지점(SDK)·소비 지점(ingest)에서 version 필드 강제
  3. zod 또는 validator로 런타임 검증
- **진입점**: `packages/ingest-server/src/stores/d1-record-store.ts`, SDK emit 코드

#### P3. `key_observation_prefixes` version 차원

- **이유**: prefix 집계가 다 version 통계를 섞을 위험
- **작업**: `(prefix_id, version)` 복합 PK
- **진입점**: `packages/ingest-server/src/stores/d1-schema.sql.ts`

### 트리거

**언제 시작**: prefix 또는 shape 스키마 변경 계획 수립 시 (재감사). 또는 저장소 마이그레이션(D1 → PG, ClickHouse 이관) 시.

### 리스크

- **현재 shape이 안정적이라 즉시 이행 필수 아님** — backlog 유지 정당성
- **이행 순서**: P2(JSON 스키마) → P1(key_observations) → P3(prefix aggregates)
- **호환성**: 이행 중 구·신 스키마 병행 기간 필요 (dual-write)

---

## 5. Marginal Density Gate

**우선순위**: 낮음 (운영 지표 필요 시)

### 현재 상태

- 계획: `docs/specs/event-vocab-system/event-taxonomy-marginal-density.plan.md`
- 현재 gate는 `classificationRate`만 체크

### 미구현

- registry-service API endpoint (`/api/event-catalog/taxonomy/marginal-density`)
- gate script 확장 (jq 파싱)
- threshold (underutilized < 0.1, saturated > 0.9)
- 3-phase 도입 (정보제공 → 대시보드 → 게이팅)

### 구현 단위

1. **Phase 1 — 조회 API**
   - endpoint: `GET /api/event-catalog/taxonomy/marginal-density?catalog=&prefix=&version=`
   - response: axes[]와 underutilized/saturated 목록
   - 데이터 소스: `key_observations.distinct` 집계 vs `PrefixCodec` shape

2. **Phase 2 — 대시보드**
   - viz-web 또는 Grafana
   - 축별 활용률 시계열

3. **Phase 3 — 게이팅**
   - CI gate threshold 합의 (실데이터 측정 후)
   - `saturated` 축 발견 → capacity 확장 plan 트리거
   - `underutilized` 축 → scope-expansion decision-flow 연계

### 진입점

- 시작 파일: `packages/registry-service/src/taxonomy/` (새 모듈)
- 계획: `event-taxonomy-marginal-density.plan.md`

### 의존

- `key_observations` 또는 `event_records`의 distinct 집계 쿼리
- `coordinate-storage.rule §2.1 준수` — 단일 `(prefix, version)` 필터

### 트리거

**언제 시작**: 운영 중 "왜 축 활용이 낮은가"에 대한 답이 필요해질 때. 또는 capacity planning 결정을 정량 근거로 해야 할 때.

### 리스크

- **측정 비용**: `COUNT DISTINCT` × 축 개수 × catalog 수 → DB 부담. 주기적 집계 테이블 필요할 수 있음
- **Noise**: 초기 트래픽 적은 서비스는 모두 underutilized → threshold 조정
- **Scope 변동**: 축이 자주 변하면 지표 의미 소실 — shape 안정성 전제

---

## 6. coordinate-storage.rule — 준수 자동화

**우선순위**: 중간 (신규 PR 리뷰 기준으로 사용 중)

### 현재 상태

- 규칙: `docs/specs/system/coordinate-storage.rule.md` ✅ 확정
- `docs/specs/system/README.md` index 등록 ✅
- CLAUDE.md 좌표 컨벤션에 참조 ✅

### 향후 작업

#### 6.1 리뷰 체크리스트

- 새 좌표 저장 스키마 PR template에 체크박스 추가
- 항목:
  - [ ] `(prefix_id, version, address)` 3컬럼 또는 JSON에 version 필드?
  - [ ] PK/UNIQUE에 version 포함?
  - [ ] rule 문서 참조?

#### 6.2 `def validate` 자동 검출

- `def validate`에 신규 검사 추가:
  - 패턴 매칭으로 좌표 저장 의심 테이블 찾기 (`address INTEGER` 컬럼 + `WI.encode` 호출)
  - version 컬럼 유무 검증
  - false positive 허용 (opt-out 태그)

- 위치: `packages/definition-catalog/src/validate.ts` 또는 별도 검사 모듈

#### 6.3 ingest-audit 연계

- P1~P3 이행 시 본 규칙의 legacy 예외 해소
- 이행 완료 후 감사 문서(§4) 종료

### 트리거

**6.1**: 다음 좌표 저장 PR이 등장할 때 (선제적으로 만들 수도)
**6.2**: def validate 확장 세션에서
**6.3**: Ingest audit P1~P3 시작 시 연동

### 리스크

- **자동 검출의 false positive**: `address` 컬럼명이 다른 의미로 쓰이는 경우 다수. allowlist 관리 필요
- **리뷰어 피로**: 체크리스트가 길어지면 무시. 자동화가 완료된 항목만 명시적 체크

---

## 의존 그래프

```
Audit DB 어댑터 ──┬── [트리거: 관측 인프라 확장]
                 ├── OTEL wrapper (peer)
                 └── 다른 어떤 것도 블록하지 않음

Bitmap pipeline ──┬── [트리거: auth service 통합]
                 ├── Redis (인프라)
                 ├── role-registry (이미 있음)
                 └── audit-layer 감사 이벤트 (Audit DB 어댑터 이후 자연스러움)

RLS ─────────────┬── [트리거: PG 이행]
                 ├── resource_policies PG 스키마 (SQLite 있음)
                 └── bitmap pipeline의 session 주입 경로

Ingest audit ────── [트리거: shape 변경 계획]
                    독립

Marginal density ── [트리거: 운영 지표 필요]
                    독립

coordinate-storage.rule 자동화 ── [트리거: def validate 확장 세션]
                                  독립 (6.3은 ingest audit 연계)
```

---

## 세션 재개 치트 시트

새 세션 시작 시:

1. **어떤 항목을 시작하는가** — 위 6개 중 선택
2. **관련 스펙 다시 읽기** — 각 항목의 진입점에 명시
3. **현재 구현 스택 확인** — §0 기준선 (모든 선행 의존 이미 있음)
4. **E2E 테스트 돌려보기** — `cd packages/resource-policy-store && pnpm test` (회귀 확인)
5. **해당 항목의 구현 단위 Phase 1부터** — 스펙 §방법 순서 따름

### 자주 참조할 파일

| 용도 | 경로 |
|---|---|
| FSM 순수 함수 | `packages/permission-engine/src/resource-policy/state.ts` |
| Registry 인터페이스 | `packages/permission-engine/src/resource-policy/registry.ts` |
| Drizzle 어댑터 예시 | `packages/resource-policy-store/src/drizzle-registry.ts` |
| AccessChecker 진입 | `packages/permission-engine/src/access-checker/checker.ts` |
| E2E 시나리오 | `packages/resource-policy-store/src/e2e-integration.test.ts` |
| DisjointUnionIndex | `packages/weighted-index/src/vocab/union-index.ts` |

### 설계 결정 기록

재협상 없이 따를 것 (근거는 각 스펙에 있음):

- Unified versioning (union 전체 단일 v)
- target_kind sum type (곱셈 아닌 합산)
- Transaction = API (별도 권한 레이어 없음)
- Pass 2 역전이 금지 (접근 축소는 policy 변경)
- Hybrid 동기화 (생성 시 UNREGISTERED flag)
- OTEL span_id 재사용 (별도 ID 체계 없음)

---

## Plan 진행 (Phase 2 ~ Phase 4)

| Plan | 책임 | 상태 |
|---|---|---|
| 04a~d | infra-engine PG container + db-bootstrap | ✓ |
| 05a~d | resource-policy-store dual-target | ✓ |
| 06a~c | audit-recorder-store dual-target | ✓ |
| 07a~d | ingest-server key_observations PG | ✓ |
| 09a~d | sim 인프라 부트스트랩 | ✓ |
| 10a~c | sim 9 서비스 스캐폴딩 | ✓ |
| 11a~c | sim 도메인 모델 | ✓ |
| 11a-1/11b-1/11b-2/11d | Phase 4 인프라 gap 해소 | ✓ |
| 12a~c | sim cross-service 통신 + 권한 통합 | ✓ |
| 12a-1/12c-1 | Phase 4 통합 gap 해소 | ✓ |
| 13a~d | sim 8 시나리오 구현 | ✓ |
| 14a | sim §5 marginal density 측정 | ✓ |
| 14b | sim 통합 회귀 + 문서 | ✓ |
| 15a~e | Phase 3 RLS FORCE | ✓ |

Phase 4 (sim Enterprise PM) 종료. 다음 Phase 5는 별도 backlog로 분리하여 다룰 예정:

- registry-service `/api/event-catalog/taxonomy/marginal-density` endpoint
- HMAC secret rotation, RS256 KID
- OTel collector (Tempo/Jaeger) + Grafana 통합
- 부하 시나리오 (100+ user 동시)
- Density gating (§5 §4 Phase 3)
- CI matrix 통합 (sim:smoke → GitHub Actions)

`simulations/enterprise-pm`이 qa-sdk 5축의 회귀 게이트 — 상세: [`/docs/specs/sim-erp-pm-coverage.spec.md`](../../specs/sim-erp-pm-coverage.spec.md).
