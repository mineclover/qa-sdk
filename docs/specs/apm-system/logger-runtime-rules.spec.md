---
def:
  id: logger-runtime-rules
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [observability, tier-system]
  links:
    - target: logger-spec
      type: refines
---

# 로거 런타임 규칙

## 목적 ^purpose

로거의 동작 조건, 실패 처리, 테스트 커버리지 기준을 분리해 수집 경로가 런타임 차이로 흔들리지 않게 만든다.

## 동작 제약

- 로거는 이벤트 생성 경로를 막지 않는 fail-open 동작을 기본으로 삼아야 한다.
- 기록 과정에서 필요한 최소 메타데이터가 없으면 누락 사실을 남기고, 호출자를 크래시시키지 않는다.
- 버퍼와 flush 정책은 전송 지연보다 데이터 손실 방지를 우선하는 방향으로 조정한다.

## 테스트 기준

- 설정 조합, 파라미터 직렬화, 실패 시 fallback 경로를 각각 독립 테스트로 검증한다.
- 브라우저/서버 차이는 공통 계약 테스트와 런타임별 얇은 어댑터 테스트로 분리한다.
