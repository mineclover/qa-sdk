---
def:
  id: apm-codegen-system
  level: module
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [structural, tier-system]
  links:
    - target: codegen-cli-contract
      type: contains
    - target: codegen-schema-output
      type: contains
---

# APM 코드젠 그룹

## 목적 ^purpose

SchemaSnapshot 기반 codegen을 CLI 실행 계약과 protobuf/TypeScript 산출물 규칙으로 나눠 유지보수 경계를 분명히 한다.

## 구성 ^overview

- `codegen-cli-contract`: 스냅샷 입력, 명령 실행, 생성 순서를 담당하는 CLI 계약.
- `codegen-schema-output`: protobuf 메시지와 TypeScript 타입 산출물의 구조와 확장 포인트를 정리한 문서.

원본: `docs/specs/apm/codegen.spec.md` (`codegen-spec`)
