---
def:
  id: logger-contract
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [observability, tier-system]
  links:
    - target: logger-spec
      type: refines
---

# 로거 계약

## 목적 ^purpose

QaLogger의 인터페이스, 설정 객체, 기록 파라미터를 분리해 이벤트 수집의 핵심 진입점 계약을 명확히 한다.

## 인터페이스

- 로거는 이벤트 생성 코드가 transport/저장 구현을 몰라도 되도록 얇은 기록 인터페이스를 제공한다.
- `QaLoggerConfig`는 전송 대상, 버퍼 정책, 공통 메타데이터를 포함하는 조정 지점이다.
- recording params는 이벤트 본문, 주소 컨텍스트, 타임스탬프, 부가 메타데이터를 한 배치로 묶는다.

## 설정 원칙

- 로거 설정은 브라우저/서버 런타임에 따라 바뀌더라도 기록 인터페이스 자체는 유지해야 한다.
- 설정이 불완전하면 이벤트를 버리기보다 경고와 함께 최소 정보 기록을 우선한다.
