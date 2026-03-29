---
def:
  id: definition-harness
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [entry-point, tier-system]
  links:
    - target: definition-state-model
      type: depends_on
    - target: definition-taxonomy
      type: depends_on
    - target: spec-verification-system
      type: depends_on
    - target: definition-harness-cli
      type: contains
    - target: definition-harness-persistence
      type: contains
    - target: definition-harness-derive
      type: contains
---
# Definition Harness — 상태 기반 문서 관리 자동화

## 목적 ^purpose

유한 상태 모델(state-model)을 실제 문서/시스템에 적용하는 접착층. CLI 통합, 상태 영속화, 자동 상태 파생을 제공하여 문서 관리를 상태 머신으로 구동한다. state-model이 엔진이라면, harness는 엔진을 실제 차에 장착하는 것이다.

## 구성 ^overview

3개 하위 모듈:

- `definition-harness-cli`: CLI에서 상태 분포 조회, 전이 실행, 리포트 출력
- `definition-harness-persistence`: 상태 인스턴스를 def-config.json 또는 DB에 영속화
- `definition-harness-derive`: 코드/테스트/문서 상태에서 SPEC_IMPL/CONVENTION 상태 자동 파생

## 해결하는 GAP ^intent

state-model 구현 검토에서 발견된 4가지 GAP:

| GAP | 문제 | 해결 모듈 |
|-----|------|----------|
| CLI 미통합 | 상태 분포를 CLI에서 조회할 수 없음 | harness-cli |
| 인스턴스 영속화 없음 | 프로세스 종료 시 상태 소멸 | harness-persistence |
| guard 함수 미사용 | 전이 조건 검증이 호출자 책임 | harness-derive (guard 주입) |
| 자동 상태 파생 없음 | 문서의 현재 상태를 수동 판단 | harness-derive |

## 설계 원칙 ^constraint

- state-model 엔진은 순수 — harness가 부수 효과(IO, DB) 담당
- 상태 파생은 코드 기반 (파일 존재, 테스트 통과, 소스 참조 여부)
- 영속화는 def-config.json 확장 — 별도 저장소 만들지 않음
- CLI 커맨드는 기존 def 서브커맨드로 통합 (def state)
