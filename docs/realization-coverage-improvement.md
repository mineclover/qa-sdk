# Realization Plan: Entry 커버리지 15% → 60% 개선

> Status: draft
> Created: 2026-03-22

## 1. 현재 커버리지 분석

### 1.1 전체 현황

| 지표 | 수치 |
|------|------|
| 전체 축 | 67개 |
| 전체 entry | ~414개 |
| 관측된 entry | ~58개 |
| **커버리지** | **~15%** |
| 전체 prefix | 34개 |
| 관측 이벤트 생성되는 prefix | 6개 |
| 완전 미관측 prefix | 28개 |

### 1.2 도메인별 커버리지

| 도메인 | 축 수 | entry 수 | 관측 entry | 커버리지 | 관측 원천 |
|--------|-------|----------|-----------|---------|----------|
| dev (qa_pkg, qa_module, build/test_result) | 7 | ~91 | ~65 | ~71% | self-check live |
| shopping (env, region, svc_name, role 등) | 18 | ~80 | ~9 | ~11% | synthetic 6건 |
| dkg_meta (obs_source, lifecycle_state 등) | 9 | ~80 | 0 | 0% | 미관측 |
| observation_point (flow_name, flow_step 등) | 6 | ~32 | 0 | 0% | 미관측 |
| infra (deploy_action, health_status 등) | 6 | ~36 | 0 | 0% | 미관측 |
| pattern (identification_mode 등) | 5 | ~30 | 0 | 0% | 미관측 |
| 기타 (relational, pipeline, internal) | 16 | ~65 | 0 | 0% | 미관측 |

### 1.3 근본 원인

1. self-check = 빌드/테스트만 실행 → dev-domain 외 원천 부재
2. 합성 이벤트가 극히 제한적 (6건)
3. 쇼핑/인프라/패턴 도메인은 실서비스 실행 필요
4. DKG write 이벤트가 self-check에 미포함
5. 일부 entry는 정상 시스템에서 구조적으로 발생 불가 (error-path)

---

## 2. 구조적 dormant vs 진짜 미사용 구분

### 2.1 분류 체계

| 분류 | 정의 | 조치 |
|------|------|------|
| **error-path** | 오류/장애 시에만 발생 | dormant가 정상. coverage 분모에서 제외 |
| **forward-designed** | 미래 확장용. 아직 구현체 없음 | 로드맵 연동 |
| **source-gap** | 관측 원천 존재하지만 이벤트 생성 코드 없음 | Phase 1~3에서 해소 |
| **structural-phantom** | 불필요하거나 중복 | Phase 4에서 비활성화 |

### 2.2 error-path entry (~22개)

건강한 시스템에서는 관측되지 않는 것이 정상:

| 축 | entry |
|----|-------|
| build_result | `failure`, `type-error` |
| test_result | `failed`, `error`, `skipped`, `timeout` |
| health_status | `unhealthy`, `maintenance` |
| verdict_result | `fail`, `degraded`, `unknown` |
| flow_step | `failure`, `timeout` |
| flow_variant | `retry`, `fallback`, `manual` |
| deploy_action | `rollback`, `canary_start`, `canary_promote` |
| anomaly_severity | `critical` |

**이 22개는 coverage 목표에서 제외.** 조정 기준: ~392개.

### 2.3 DormantReason 타입 추가

```typescript
export type DormantReason =
  | "error-path"
  | "forward-designed"
  | "source-gap"
  | "structural";
```

---

## 3. Phase 1: self-check에서 도메인별 합성 이벤트 생성

### 3.1 목표

커버리지 15% → 48%. `BIZ_PREFIXES` 6건 → `SYNTHETIC_EVENTS` ~60건.

### 3.2 합성 이벤트 확장

#### 쇼핑 도메인 (~50 entry)

| prefix | 합성 이벤트 예시 | 신규 관측 entry |
|--------|----------------|----------------|
| service | dev/asia/shopping-web/shop | env, region, svc_name, namespace |
| tracking | click/home/guest, view/product_detail/member | trackAction, page, userType |
| page_view | home/ko/guest | page, locale, userType |
| rbac | admin/read/dashboard | rbac_role, action, resource |
| content | frontend/tech/published/ko/web | tag, category, status, locale, channel |
| flow_point | checkout/entry/default | flow_name, flow_step, flow_variant |

#### DKG 도메인 (~40 entry)

| prefix | 합성 이벤트 예시 |
|--------|----------------|
| dkg_event | claim/prefix, decide/decision |
| skill_execution | skill-trace/read/ok |
| cli_event | query/dkg-graph/prefix |

#### 인프라/패턴/내부 (~30 entry)

| prefix | 합성 이벤트 예시 |
|--------|----------------|
| deploy_event | deploy/svc_ref |
| pipeline_point | ingest/strict/pass/span_local |
| pattern_match | anonymous/browse_only/medium |

### 3.3 구현 위치

`packages/spec-core/src/convergence/self-check-analyzer.ts`의 `BIZ_PREFIXES` → `SYNTHETIC_EVENTS` 확장.

### 3.4 예상 결과

| 지표 | 현재 | Phase 1 후 |
|------|------|-----------|
| 관측 entry | ~58 | ~215 |
| 커버리지 | 15% | 48% |
| 관측 prefix | 6개 | ~30개 |

---

## 4. Phase 2: E2E 시나리오 → 도메인 매핑 확장

### 4.1 목표

커버리지 48% → 55%. E2E 테스트의 실제 이벤트를 커버리지에 반영.

### 4.2 방법

1. E2E 실행 시 `qa_session_id` 추적
2. self-check에서 ingest-server API로 레코드 조회
3. address_context를 `aggregateUsageData`에 추가
4. 쇼핑 도메인 entry 자동 관측

### 4.3 E2E에서 관측 가능한 entry

| 시나리오 | 관측 prefix |
|---------|------------|
| shopping-flow | tracking, page_view, flow_point, cart_event, auth_event, order_event |
| anonymous-browse | tracking, page_view (userType:guest) |
| cart-abandon | tracking, cart_event, flow_point (flow_step:exit) |
| multi-product-purchase | tracking, order_event |

---

## 5. Phase 3: 런타임 convergence pipeline 커버리지

### 5.1 목표

커버리지 55% → 60%. 실서비스 이벤트 자동 반영.

### 5.2 추가 작업

1. convergence flush 시 `analyzeEntryCoverage` 호출 → 커버리지 스냅샷 저장
2. DKG store에 커버리지 히스토리 테이블
3. 서비스별 좌표 이벤트 생성:
   - registry-service: 버전 활성화 → `version_point`
   - gate-service: 상태 변경 → `gate_point`
   - ingest-server: 파이프라인 처리 → `pipeline_point`

---

## 6. Phase 4: dormant entry 정리

### 6.1 기준

Phase 3 완료 후 90일 이상 관측되지 않은 entry를 후보로 선정.

| 판정 | 조치 |
|------|------|
| error-path | 유지. `dormantReason: "error-path"` 태깅. coverage 분모 제외 |
| forward-designed | 유지. 로드맵에 구현 시점 명시 |
| 진짜 미사용 | capacity에서 제거하지 않고 entry를 deprecated 처리. 축 version bump |
| 중복/잉여 | simplification-advisor 교차 검증 후 결정 |

---

## 7. 목표 + 검증 기준

### 7.1 Phase별 목표

| Phase | 목표 커버리지 | 관측 entry | 관측 prefix |
|-------|-------------|-----------|------------|
| 현재 | 15% | ~58/414 | 6/34 |
| Phase 1 | 48% | ~215/414 | ~30/34 |
| Phase 2 | 55% | ~245/414 | ~33/34 |
| Phase 3 | 60% | ~270/414 | ~34/34 |
| Phase 4 | 65% (실질) | ~270/392 (error-path 제외) | ~34/34 |

### 7.2 검증 기준

| # | 기준 | 방법 |
|---|------|------|
| V1 | self-check 커버리지 48% 이상 | `overallCoverageRate >= 0.48` |
| V2 | 모든 도메인 최소 1개 observed | 도메인별 커버리지 > 0% |
| V3 | dormantReason 분류 완료 | 필드 100% 채워짐 |
| V4 | error-path 별도 카운트 | `errorPathCount` 필드 존재 |
| V5 | synthetic/live 구분 | `sourceStats.byExecutionMode` |
| V6 | 90일 이상 전체 미관측 prefix 0개 | 모든 prefix 최소 1개 observed |

### 7.3 CoverageReport 확장

```typescript
export interface CoverageReport {
  // 기존 필드
  readonly errorPathCount: number;
  readonly forwardDesignedCount: number;
  readonly adjustedCoverageRate: number;  // error-path 제외 기준
  readonly domainCoverage: Record<string, {
    defined: number;
    observed: number;
    rate: number;
  }>;
}
```

### 7.4 의존 관계

```
Phase 1 (합성 확장) — 독립 실행 가능
    ↓
Phase 2 (E2E 연동) — Phase 1 + E2E 환경
    ↓
Phase 3 (런타임) — Phase 1 + 서비스 배포
    ↓
Phase 4 (정리) — Phase 1~3 완료 + 90일 관측
```

Phase 1은 즉시 시작 가능. Phase 2~3 병렬 가능.
