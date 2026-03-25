---
def:
  id: ingest-interface-contract
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: ingest-api-spec
      type: refines
    - target: transmission-spec
      type: depends_on
---

# Ingest 인터페이스 계약

## 목적 ^purpose

SDK가 보내는 Transmission Envelope을 수신하는 ingest 엔드포인트의 입력, 응답, 저장 의존 계약을 분리해 정리한다.

## 엔드포인트 계약

- ingest API는 배치 단위 envelope을 받아 기록 단위로 분해하기 전의 감사 메타데이터를 보존해야 한다.
- 응답 계약은 동기 저장 성공 여부와 후속 처리 예정 여부를 명확히 전달해야 한다.
- 의존 포트는 전송 저장소와 canonical record 저장 경계를 분리해 장애 범위를 좁힌다.
