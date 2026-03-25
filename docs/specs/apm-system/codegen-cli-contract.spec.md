---
def:
  id: codegen-cli-contract
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: codegen-spec
      type: refines
    - target: cli-contract-spec
      type: depends_on
---

# 코드젠 CLI 계약

## 목적 ^purpose

SchemaSnapshot을 입력으로 받아 protobuf/TypeScript 생성 파이프라인을 실행하는 CLI 진입점과 단계별 책임을 정리한다.

## 입력과 실행

- codegen은 registry snapshot, 출력 경로, 대상 언어 조합을 받아 동일한 생성 절차를 반복 가능하게 만든다.
- 명령 단계는 스냅샷 로드, 스키마 검증, 출력물 생성, 포맷팅/쓰기 순서로 고정한다.
- CLI는 `cli-contract-spec`이 정의한 관측 도구와 같은 실행 모델을 사용해 실패 지점을 추적 가능하게 남긴다.

## 파이프라인 제약

- protobuf 정의와 TypeScript 타입 생성은 같은 snapshot 버전을 공유해야 한다.
- 확장 포인트는 생성 단계 사이에만 허용하고, snapshot 파싱 규칙 자체는 분기시키지 않는다.
- 실패 시 부분 생성물을 남기기보다 전체 배치를 다시 생성하는 편이 drift를 줄인다.
