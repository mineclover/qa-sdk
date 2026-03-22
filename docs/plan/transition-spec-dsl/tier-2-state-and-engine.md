# Tier 2 — 축 기반 상태 + Transition Engine [완료]

> 상태를 별도 vocabulary가 아닌 DEMO_CATALOG 축으로 표현.
> collect→match→bind→load→validate→apply→emit 7단계 파이프라인.
> 시스템의 성격이 바뀌는 지점: 관찰 → 관찰 + 상태 재구성.

## 핵심 설계 결정

### 상태 = 축의 entry

별도 slot vocabulary를 만들지 않는다. 상태는 DEMO_CATALOG의 축으로 표현한다.

| 용도 | 축 | 비고 |
|------|---|------|
| 흐름 위치 | `flow_step` | entry → processing → success |
| 자원 생명주기 | `lifecycle_state` | draft → active → deprecated |
| 자원 위치 | `resource_location` **(신설)** | origin, cache, queue, external |
| 버전 단계 | `version_lifecycle` | draft → locked → released |
| 존재 여부 | `lifecycle_state` 유무 | exists: false = 미설정 |
| 소유자 | table_ref (`members`) | 기존 패턴 |

### resource_location 축 신설

5Q 충족. DKG Decision `DEC-NEW-AXIS-resource_location` 기록됨 (DEMO_DKG_CONFIG.decisions).

### address_context 전제

TransitionEngine은 디코딩된 이벤트를 소비한다. address_context는 `{ 축이름: entry값 }` 매핑. 인코딩된 prefix 주소(`"tracking:v2:42"`)가 아님. decode 책임은 호출자(Tier 3의 Phase 2.5 또는 전처리 어댑터).

### 타임스탬프 정렬

`compareTimestamps()` (`@qa-sdk/core`) 사용. ISO-8601 문자열 비교는 밀리초 유무에 따라 잘못된 순서를 만든다 (`"10:00:00Z"` > `"10:00:00.100Z"`). Date 기반 비교로 해결.

## 구현 파일

```
packages/spec-core/src/transition/
  state-store.ts         — InMemoryStateStore
  bind-extractor.ts      — $.events[N].field 경로 추출 (깊이 2)
  input-validator.ts     — eq/neq/in/exists (축 entry 기준)
  output-applier.ts      — set/unset (축 entry 변경)
  catalog-validator.ts   — catalog 기반 축/entry 2단계 검증
  transition-engine.ts   — 7단계 파이프라인

packages/demo-snapshot/src/
  demo-catalog.ts        — resource_location 축 추가 (68번째)
  demo-dkg-config.ts     — DEC-NEW-AXIS-resource_location 추가

packages/core/src/lib/
  clock.ts               — normalizeTimestamp, compareTimestamps 추가
```

## 실증 (proof-of-value.test.ts)

shop-web 실제 checkout 흐름 13개 이벤트, 4개 transition spec:

```
user.login        — 세션 생성 (lifecycle_state: active)
checkout.entry    — 체크아웃 진입 (flow_step: entry)
order.create      — 주문 생성 (lifecycle_state: active, resource_location: origin)
payment.complete  — 결제 완료 (flow_step: success)
```

### 시나리오 A: 정상 흐름
- 4개 전이 순서대로 실행
- 최종 상태: `{ lifecycle_state: active, flow_step: success, resource_location: origin }`
- unmatched 이벤트 3개 (탐색/장바구니 — transition spec 미정의)

### 시나리오 B: 비정상 흐름 (주문 없이 결제)
- order.create 이벤트 누락 → payment.complete에서 input violation
- `lifecycle_state eq "active"` 조건 실패 (주문이 생성되지 않아 상태 없음)
- Verdict는 이벤트 존재만 확인 → pass 가능. Transition은 상태 전제조건 위반을 잡는다.

### 시나리오 C: 시점 질의
- 중간까지 이벤트 → 중간 상태 (`flow_step: processing`, 결제 미완료)
- 전체 이벤트 → 최종 상태 (`flow_step: success`)
- 2회 replay → 동일 결과 (deterministic)

## 완료 기준 ✓

- [x] `resource_location` 축 DEMO_CATALOG에 추가
- [x] `state-store.ts` — InMemoryStateStore
- [x] `catalog-validator.ts` — catalog 기반 축/entry 검증 (7개 테스트)
- [x] `input-validator.ts` — eq/neq/in/exists
- [x] `output-applier.ts` — set/unset
- [x] `bind-extractor.ts` — 제한된 경로 추출
- [x] `transition-engine.ts` — 7단계 파이프라인
- [x] deterministic replay 테스트
- [x] DEMO_CATALOG 기반 e2e 연쇄 전이 (checkout→payment)
- [x] DKG Decision (resource_location 신설 근거)
- [x] address_context 디코딩 전제 명시 (TransitionEvent JSDoc)
- [x] 실증 테스트 (shop-web checkout 3시나리오, 10개 테스트)
- [x] 타임스탬프 정규화 (`compareTimestamps` 도입, 기존 4곳 교체)

## 부수 개선

- **하드코딩 카운트 제거**: lifecycle-e2e, cli-query, self-evaluation 테스트에서 축/prefix/domain 수를 SSOT(DEMO_CATALOG/DEMO_DKG_CONFIG)에서 파생하도록 변경
- **CLAUDE.md 컨벤션 추가**: "카탈로그 파생 카운트 하드코딩 금지", "ISO-8601 타임스탬프 비교 — 문자열 비교 금지"
