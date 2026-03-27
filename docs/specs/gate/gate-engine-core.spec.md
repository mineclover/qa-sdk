---
def:
  id: gate-engine-core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security, tier-infra]
  links:
    - target: gate-state-model
      type: depends_on
---
# GateEngine 코어 기능

## 목적 ^purpose

GateEngine 클래스의 코어 기능. recompute(단일 재계산), cascadeRecompute(composite 전파), AddressStateCacheRecord 관리.

## 구성 ^overview

- **4-state 모델**: active(정상) / inactive(인코딩 차단, 디코딩 가능) / open(인코딩 가능, 디코딩 불가) / reserved(완전 차단)
- **recompute**: DimStateSpec 기반 순수 함수 — dim별 inactive/open 좌표로 전체 주소 범위 상태 계산
- **cascadeRecompute**: leaf prefix 상태 변경을 composite prefix까지 DFS 순회로 전파, AND 규칙 적용
- **Deactivation 모드**: strict(release 시에만 재계산) / flexible(setFlag 시에도 재계산)
- **CON-006**: prefix_ref refEntries 미정의 시 unfilled positions는 reserved 처리

---

## 상태 계산 (recompute)

dim별 inactive/open 좌표를 기반으로 전체 주소 범위의 상태를 계산한다.

- 입력: DimStateSpec (dim별 비활성 좌표 목록)
- 출력: AddressStateCacheRecord (reserved/inactive/open 범위)
- 순수 함수: 같은 입력 → 같은 출력

### 4-state 모델

| 상태 | encode | decode | 설명 |
|------|--------|--------|------|
| active | O | O | 정상 사용 |
| inactive | X | O | 인코딩 차단, 디코딩 가능 (과거 데이터 복원) |
| open | O | X | 인코딩 가능, 디코딩 불가 (미래 예약) |
| reserved | X | X | 완전 차단 |

### composite AND 규칙

어느 dim이라도 차단 → composite도 차단.
`inactive ∩ open → reserved` 자동 승격.

---

## Cascade 전파 (cascadeRecompute)

leaf prefix의 상태 변경을 composite prefix까지 전파한다.

- leaf → composite 역참조 그래프를 DFS 순회
- 각 composite에서 AND 규칙 적용 후 재계산

---

## Deactivation 모드

| 모드 | recompute 시점 | 용도 |
|------|---------------|------|
| strict | release 시에만 | 안정적, 예측 가능 |
| flexible | setFlag 시에도 | 즉각 반영 |

### CON-006: prefix_ref 미정의

prefix_ref refEntries 미정의 시 unfilled positions = reserved 처리.
