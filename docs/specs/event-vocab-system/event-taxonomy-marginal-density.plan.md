---
def:
  id: event-taxonomy-marginal-density
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: experience
  tags: [monitoring, quality-gate, weighted-index, taxonomy]
  links:
    - target: event-vocab-system
      type: traces_to
    - target: event-taxonomy-roadmap-plan
      type: refines
---

# Event Taxonomy Gate — Marginal Density 확장 계획

## 목적 ^purpose

현재 `pnpm gate:event-taxonomy`는 `classificationRate` 하나로 이벤트 분류 품질을 측정한다. 이는 **질적 지표** — 관측된 이벤트 중 몇 %가 알려진 패턴으로 분류되는가. 하지만 **축 활용률** (어느 축이 실제로 관측되는가)에 대한 정보는 없다.

본 계획은 weighted-index의 shape 정보를 활용해 **축별 marginal density**를 taxonomy gate에 추가하는 작업을 정의한다.

---

## 1. 동기

### 1.1 현 지표의 한계

- **classificationRate = 100%**: 관측 전량이 분류됨. 양호.
- 하지만 `role` 축 entry 10개 중 2개만 실제 관측되면:
  - 설계 과잉 (축을 더 단순화 가능)
  - 또는 관측 누락 (트래픽이 특정 경로만 도달)
- 현재 gate는 이 차이를 구분하지 못한다.

### 1.2 등가성 문서와의 연결

`strategy-sparse.md`의 핵심 메시지:
> 전체 density 단일 숫자는 정보 손실 — 축별 marginal density(축 활용률)를 병기해야 샤딩/파티셔닝 판단 가능.

taxonomy gate에 동일 원리를 적용한다.

---

## 2. 추가 지표 정의

### 2.1 축별 marginal density

각 축 `axis_i`에 대해:

```
marginal_density(axis_i) = count_distinct(observed values of axis_i) / shape[axis_i]
```

범위: `[0, 1]`. 1에 가까울수록 축 전체가 관측됨.

### 2.2 파생 지표

- **underutilized axes**: `marginal_density < threshold` (예: 0.3)인 축 목록
- **saturated axes**: `marginal_density > 0.9`인 축 목록 (capacity 부족 징후)
- **axis entry coverage**: 축별 어느 entry가 미관측인지 명시

---

## 3. 구현 계획

### 3.1 registry-service API 확장

새 endpoint:

```
GET /api/event-catalog/taxonomy/marginal-density?catalog={id}&prefix={id}&version={v}
```

응답 스키마:

```ts
type MarginalDensityResponse = {
  catalog: string;
  prefix: string;
  version: string;
  axes: Array<{
    axisName: string;
    shapeCapacity: number;       // ∏shape axis의 용량
    observedDistinct: number;    // 관측된 distinct entry 수
    marginalDensity: number;     // observedDistinct / shapeCapacity
    unobservedEntries: string[]; // 미관측 entry ID 목록
  }>;
  underutilizedAxes: string[];
  saturatedAxes: string[];
};
```

### 3.2 Data source

- shape: `PrefixCodec` 또는 `LabelRegistry`에서 조회
- 관측 카운트: `key_observations` 또는 `event_records`에서 distinct 집계
- 연결: `prefix_id` + `version`으로 필터 (coordinate-storage.rule §2.1 준수)

### 3.3 Gate script 확장

`scripts/registry-event-taxonomy-gate.sh`에 추가:

```bash
echo ""
echo "-- marginal density --"
RESPONSE=$(curl -fsS "${BASE_URL}/api/event-catalog/taxonomy/marginal-density?catalog=${CATALOG_ID}")
echo "$RESPONSE"

# underutilized/saturated 축이 있으면 경고 출력
UNDERUTILIZED=$(echo "$RESPONSE" | jq -r '.underutilizedAxes | length')
if [ "$UNDERUTILIZED" -gt 0 ]; then
  echo "⚠️  underutilized axes detected: $(echo "$RESPONSE" | jq -r '.underutilizedAxes | join(", ")')"
fi
```

gate는 현재 pass/fail 결정에 classificationRate만 사용. marginal density는 **정보 제공 단계**로 시작하고, 추후 threshold 결정 후 게이팅화.

### 3.4 threshold 제안 (초안)

- **underutilized**: `< 0.1` (10% 미만 활용)
- **saturated**: `> 0.8` (80% 이상 활용 → capacity headroom 부족)

실데이터 측정 후 조정.

---

## 4. 단계

### Phase 1 — 조회 API (게이팅 아님)

- registry-service에 endpoint 추가
- gate script에서 출력만 (gate 결과에 영향 없음)
- 초기 CO-USE: 운영자가 수동 검토

### Phase 2 — 대시보드 통합

- 축별 활용률을 시각화 (viz-web 또는 monitoring Grafana)
- 시간 축 따라 추세 관측

### Phase 3 — 게이팅

- threshold 합의 후 CI gate에 포함
- `saturated` 축은 capacity 확장 plan 트리거
- `underutilized` 축은 scope 재검토 (scope-expansion decision-flow 연계)

---

## 5. 범위 제한

### 5.1 본 계획에 포함되지 않음

- shape 변경 자동화 (수동 migration 경로 유지)
- `classificationRate` threshold 조정
- 타 품질 지표 (drift 등)

### 5.2 단일 prefix·version 대상

다중 version 통합 집계는 `coordinate-storage.rule` §2.2 위반 가능. **단일 prefix + 단일 version** 기준만 집계한다.

---

## 6. 완료 기준

- Phase 1 API가 동작하고 `pnpm gate:event-taxonomy`가 marginal density 출력
- 운영자가 수동으로 underutilized/saturated 축을 식별 가능
- Phase 2/3은 별도 plan으로 승격

---

## 7. 리스크

- **측정 비용**: `COUNT DISTINCT` × 축 개수 × catalog 수 → DB 부담 → 주기적 집계 테이블 필요할 수 있음
- **noise**: 초기 트래픽 적은 서비스는 모든 축이 underutilized → threshold 조정으로 완화
- **scope 변동**: 축이 자주 변하면 "activity by axis"가 의미 없음 — shape 안정성 전제 필요 (`coordinate-storage.rule` §3 참조)

---

## 8. 링크

- 근거: `packages/weighted-index/docs/rdbms-equivalence/strategy-sparse.md`
- 규칙: `docs/specs/system/coordinate-storage.rule.md`
- gate 스크립트: `scripts/registry-event-taxonomy-gate.sh`
- 현 gate skill: `docs/specs/skill-catalog/automation-skill-group/skill-event-taxonomy-gate.spec.md`
