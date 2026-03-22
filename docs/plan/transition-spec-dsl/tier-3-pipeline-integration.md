# Tier 3 — 파이프라인 통합 + 수렴 + DKG [미착수]

> ingest Phase 2.5 삽입 + 수렴 metric + effect vocabulary DKG 관리.
> Tier 1+2 완료 + 실증 통과 후 진행.

## 선행 조건

- Tier 1 완료 ✓
- Tier 2 완료 ✓ (축 기반 상태 + 엔진 + 실증)
- **추가 필요**: ingest-server에서 address_context를 디코딩하여 축 이름→entry 값 매핑을 생성하는 어댑터

## 핵심 과제: address_context 디코딩 어댑터

TransitionEngine은 디코딩된 이벤트를 전제한다.
ingest-server의 address_context는 인코딩된 prefix 주소를 담는다.

```
ingest-server: { "tracking": "tracking:v2:42" }
engine 필요:   { "trackAction": "submit", "page": "checkout" }
```

Phase 2.5에 디코딩 어댑터가 필요하다:

```typescript
function decodeAddressContext(
  catalog: Catalog,
  addressContext: Record<string, string>,
): Record<string, string> {
  // 각 prefix 주소를 decodePrefix → 축 이름:entry 값으로 flat 변환
}
```

## 1. Ingest Pipeline 통합

### Phase 2.5: Transition Matching

```
Phase 2.1: Reconstruction
Phase 2.2: Metric Aggregation
Phase 2.3: Verdict
Phase 2.5: Decode + Transition Matching (NEW)
Phase 2.6: Convergence Notification (transition 결과 포함)
```

에러 격리: transition matching 실패가 verdict를 차단하지 않음.
`TRANSITION_ENGINE_ENABLED=true` 환경변수로 게이팅.

## 2. Effect Vocabulary DKG 관리

DKG constraint `CON-EFFECT-VOCAB`: effect kind는 정규 vocabulary만 허용 (create/update/move/consume/open/close).
새 effect kind 추가 시 DKG Decision 필수.

## 3. 수렴 분석 — Transition Metric 3종

| metric | 설명 | 임계값 |
|--------|------|--------|
| `transition_coverage` | 정의된 spec 중 실제 매칭 비율 | ≥0.8 ok, <0.5 issue |
| `orphan_sequence` | spec 없이 반복되는 좌표 패턴 | 빈도 ≥10 시 신규 spec 추천 |
| `input_violation_rate` | input 조건 실패 빈도 | ≤0.05 ok, >0.2 issue |

## 4. 상태 질의 API

```
GET /state/:contextId/:resourceId          — 현재 축 스냅샷
GET /state/:contextId/:resourceId/history   — transition instance 이력
GET /state/:contextId/:resourceId/at?ts=    — 시점 상태 (replay 기반)
GET /transitions?context_id=&limit=         — context별 전이 목록
```

## 5. CLI 통합

```bash
qa-sdk transition list|show|validate
qa-sdk state show|history|replay
qa-sdk transition coverage|orphans|violations
```

## 6. 환경변수

| 변수 | 기본값 | 패키지 | 설명 |
|------|--------|--------|------|
| `TRANSITION_ENGINE_ENABLED` | `false` | ingest-server | Phase 2.5 활성화 |
| `TRANSITION_STORE_PATH` | `:memory:` | ingest-server | TransitionInstance SQLite |
| `TRANSITION_STATE_PATH` | `:memory:` | ingest-server | StateStore SQLite |
| `TRANSITION_VIOLATION_MODE` | `warn` | ingest-server | `strict` = fail, `warn` = observe |

## 완료 기준

- [ ] address_context 디코딩 어댑터 (prefix 주소 → 축 이름:entry 값)
- [ ] ingest Phase 2.5 삽입 + `TRANSITION_ENGINE_ENABLED` 게이팅
- [ ] 에러 격리 테스트 (transition 실패 → verdict 미영향)
- [ ] Effect vocabulary DKG constraint (CON-EFFECT-VOCAB)
- [ ] 수렴 metric 3종 (coverage, orphan, violation)
- [ ] query-service 상태 질의 API 4개
- [ ] CLI 명령 6개
- [ ] End-to-end: shop-web 이벤트 → ingest → decode → transition → 상태 재구성
