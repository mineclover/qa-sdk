# ingest-server 좌표 저장 감사

ingest-server의 저장 스키마를 `coordinate-storage.rule.md` 기준으로 감사하고, 이행 필요성을 평가한다.

> **이행 상태 (2026-04-22)**: P1·P2·P3 모두 완료 (D1 한정). ClickHouse는 운영 도입 시점에 동기.
> 결론: "부분 준수" → **"준수"**. 상세는 본 문서 끝의 [이행 완료](#이행-완료-2026-04-22) 섹션 참조.

**결론**: 현재 저장 패턴은 `coordinate-storage.rule`의 엄격 준수는 아니지만, 대부분 실질적으로는 안전. 일부 테이블에 예외 문서화 또는 점진적 이행 필요.

감사 대상: `packages/ingest-server/src/stores/d1-schema.sql.ts` (D1 DDL, Drizzle schema와 동기)

---

## 1. 분류 체계

`coordinate-storage.rule`의 §1 기준으로 세 범주:

| 범주 | 정의 | rule 적용 |
|---|---|---|
| **A** | 정수 address 저장 (Hybrid 패턴 후보) | §1.1 적용 |
| **B** | JSON/문자열로 좌표 저장 | §1.2 적용 |
| **C** | 좌표 저장 아님 (세션·트레이스·감사 메타데이터 등) | 예외 |

---

## 2. 테이블별 감사

### 2.1 `event_records` — 범주 B (부분 준수)

| 컬럼 | 역할 | rule 평가 |
|---|---|---|
| `event_key` TEXT | 문자열 이벤트 키 | 좌표 아닌 식별자 — B의 핵심 |
| `event_version` TEXT | 이벤트 스키마 버전 | ✅ version 동봉 |
| `address_context` TEXT (JSON) | 좌표 맥락 JSON blob | ⚠️ version 필드 존재 여부 확인 필요 |

**판정**: event_key + event_version은 규칙 2.1(version 격리) 충족. `address_context` JSON 내부의 version 포함 여부는 정의부(event 디스패치 코드) 확인 필요.

**권장**: `address_context` JSON 스키마를 공식 타입으로 문서화하고 `version` 필드를 계약으로 명시.

### 2.2 `key_observations` — 범주 A (미준수)

| 컬럼 | 역할 | rule 평가 |
|---|---|---|
| `packed_key` TEXT PK | 인코딩된 좌표 문자열 | ⚠️ version 동봉 여부 컬럼상 불명 |
| `prefix_id` TEXT | prefix 네임스페이스 | ✅ §1.1의 prefix_id 요건 충족 |

**판정**: `packed_key`가 version을 encode하지 않는다면 §2.1 version 격리 불가. shape 변경 시 기존 데이터 오염 위험.

**권장**:
1. `packed_key` 포맷 분석 (version 포함 여부 확인)
2. 미포함이면 별도 `version` 컬럼 추가 (마이그레이션 필요)
3. PK를 `(prefix_id, version, packed_key)`로 확장

### 2.3 `key_observation_prefixes` — 범주 C (집계)

prefix별 aggregate. 좌표 저장 아님. 예외.

단, 여러 version의 통계가 섞이면 해석 오류 가능 → `version` 차원 추가 검토 권장.

### 2.4 `verdict_reports` — 범주 C

`scenario_id` + `trace_id` 복합. 좌표 아님. 예외.

### 2.5 `scenario_specs` — 범주 C (version 있음)

`scenario_id` PK + `version` 컬럼. scenario 정의 자체의 version으로 좌표 저장 아님. 예외.

### 2.6 기타 테이블 — 범주 C

`qa_sessions`, `traces`, `transmissions`, `dead_letter_queue`, `insight_labels`, `runtime_graphs` — 모두 좌표 저장 아님. 예외.

---

## 3. 이행 우선순위

### P1 — `key_observations` version 컬럼 추가

- **이유**: 범주 A인데 version 격리 보장 불명
- **작업**: `packed_key` 포맷 분석 → version 필드 분리 → 마이그레이션
- **규모**: 스키마 1개, 관련 store 코드 + 테스트

### P2 — `address_context` JSON 스키마 계약화

- **이유**: 범주 B인데 version 포함 여부가 암묵적
- **작업**: JSON 타입 정의 + 생산·소비 지점에서 version 필드 강제
- **규모**: 타입 정의 + validator

### P3 — `key_observation_prefixes` version 차원 검토

- **이유**: 다 version 통계 섞임 위험
- **작업**: 필요 시 `(prefix_id, version)` 복합 PK
- **규모**: 스키마 + 집계 로직

---

## 4. 이행하지 않는 결정 (justification)

위 P1~P3는 모두 **이행 가능하지만 즉시 필수는 아님**. 다음 조건이 충족되면 현상 유지 결정:

- 현재 shape 변경이 드물고, 있을 때마다 별도 migration으로 대응 가능
- 저장 크기 압축이 절실하지 않음 (JSON blob + index만으로 충분)
- 기존 코드·클라이언트 호환성이 마이그레이션 비용을 초과

현재 qa-sdk 상태는 대체로 이 조건에 부합. 따라서 P1~P3는 **backlog에 등록하되 즉시 실행은 보류**.

---

## 5. 감사 재실행 조건

다음 시점에 본 감사를 재수행:

- prefix 또는 shape 스키마 변경 계획 수립 시
- 저장소 마이그레이션(D1 → PG, ClickHouse 이관 등) 시
- `coordinate-storage.rule` 자체 개정 시
- 신규 좌표 저장 테이블 추가 시

---

## 6. 링크

- 규칙: `docs/specs/system/coordinate-storage.rule.md`
- 전략: `packages/weighted-index/docs/rdbms-equivalence/strategy-hybrid.md`
- 이행 체크리스트: (P1 실행 시 별도 todo 문서로 승격)

---

## 이행 완료 (2026-04-22)

| 항목 | 상태 | 위치 |
|---|---|---|
| P1 — `key_observations` version 컬럼 | ✅ 완료 | `packages/ingest-server/src/db/schema.ts`, `packages/ingest-server/src/stores/d1-key-observation-store.ts`, 마이그레이션 `packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts` |
| P2 — `address_context` JSON 스키마 계약 | ✅ 완료 | `AddressContextV1Schema` in `@qa-sdk/core/coordinates/address-context-schema` + SDK `auto-track` emit 시점 검증 |
| P3 — `key_observation_prefixes` version 차원 | ✅ 완료 | schema/store/마이그레이션 `0002_key_observation_prefixes_versioned.sql.ts` |

ClickHouse 스키마는 운영 도입 시점에 동기 (보류). `packages/ingest-server/src/stores/clickhouse-schema.sql.ts` 상단 TODO 참조.

**본 감사 결론 변경**: "부분 준수" → **"준수"**.

다음 재감사 트리거: 신규 좌표 저장 테이블 추가, ClickHouse 운영 도입, PG 스키마에 동일 패턴 적용.
