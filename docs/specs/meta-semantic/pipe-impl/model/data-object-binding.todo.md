---
def:
  id: data-object-binding
  level: module
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: implemented
  layer: domain
  links: []
---

# DataObject Binding — 잔여 구현 항목

## CLI codegen 연동

- [x] CLI `qa-sdk codegen --data-objects` 명령 연동
  - bindings 입력 소스: JSON 파일 (DataObjectBinding[] 배열)
  - 생성 파일 출력 경로: --output 플래그 (기본 ./generated)

## prefix-stamp 바인딩 스탬프

- [x] prefix-stamp에서 바인딩 스탬프 지원
  - `*_BINDING` 상수의 `prefixId` 리터럴을 앵커로 감지
  - import 구문에서 바인딩 변수 감지 → 파일 내 prefixId 참조 추적
