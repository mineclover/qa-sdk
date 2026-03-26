---
def:
  id: codegen-schema-output
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [tier-system]
  links:
    - target: codegen-spec
      type: refines
---

# 코드젠 산출물 계약

## 목적 ^purpose

APM codegen이 만드는 protobuf 메시지와 TypeScript 타입의 구조, 버전 고정 규칙, 확장 지점을 분리해 설명한다.

## 산출물 구조

- protobuf 메시지는 전송/저장 경계를 고정하고, TypeScript 타입은 SDK와 서버 구현의 공유 계약을 담당한다.
- 생성기는 snapshot의 prefix, axis, payload 규칙을 읽어 언어별 이름과 필드 배치를 결정한다.
- 산출물은 사람 손수정을 전제로 하지 않으며, snapshot 변경 후 재생성이 기본 경로다.

## 버전과 확장

- 메시지 번호와 타입 이름은 같은 snapshot에서 안정적으로 다시 생성돼야 한다.
- 전송 최적화나 SDK 예시는 산출물을 소비하는 단계이지, 산출물 정의 자체를 바꾸는 확장 지점이 아니다.
- 새 도메인을 추가할 때는 생성기 플러그인을 늘리기 전에 snapshot 표현력이 충분한지 먼저 검토한다.
