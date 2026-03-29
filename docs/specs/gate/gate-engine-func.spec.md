---
def:
  id: gate-engine-func
  address: def_document:v2:68773
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-state-model
      type: depends_on
---
# GateEngine 기능 명세

## 목적 ^purpose

주소 상태를 자동으로 계산하고, 변경을 전파하고, 질의에 gate 필터를 적용하는 엔진.
순수 함수 기반으로 같은 입력이면 같은 출력을 보장한다.

## 구성 ^overview

3개 핵심 함수: recompute(단일 재계산), cascadeRecompute(composite 전파), gateFilterRanges(범위 필터).
2개 deactivation 모드: strict(release 시만), flexible(setFlag 시에도).

## 핵심 기능

### 상태 계산 (recompute)

dim별 inactive/open 좌표를 기반으로 전체 주소 범위의 상태를 계산한다.

- 입력: DimStateSpec (dim별 비활성 좌표 목록)
- 출력: AddressStateCacheRecord (reserved/inactive/open 범위)
- 순수 함수: 같은 입력 → 같은 출력

### Cascade 전파 (cascadeRecompute)

leaf prefix의 상태 변경을 composite prefix까지 전파한다.

- leaf → composite 역참조 그래프를 DFS 순회
- 각 composite에서 AND 규칙 적용 후 재계산

### Gate-Aware Query (gateFilterRanges)

주소 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환한다.

- mode: encodable (active+open), decodable (active+inactive), active
- policy resolution과 gate 상태를 합성

## Deactivation 모드

| 모드 | recompute 시점 | 용도 |
|------|---------------|------|
| strict | release 시에만 | 안정적, 예측 가능 |
| flexible | setFlag 시에도 | 즉각 반영 |
