---
def:
  tier: component
  id: codegen-cli-contract
  address: def_document:v2:413825
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [entry-point, contract, structural]
  links:
    - target: apm-codegen-system
      type: refines
    - target: cli-contract-spec
      type: depends_on
  sources:
    - packages/cli/src/commands/codegen.ts
    - packages/cli/src/commands/codegen.test.ts
    - packages/cli/src/scenarios.e2e.test.ts
---

# 코드젠 CLI 계약

## 목적 ^purpose

Catalog 또는 Registry를 입력으로 받아 TypeScript SDK 생성 파이프라인을 실행하는 CLI 진입점과 단계별 책임을 정리한다.

## 입력과 실행

- codegen은 `--catalog <경로>` 또는 `--registry <URL>` 중 하나를 필수로 받는다. 둘 다 없으면 에러.
- registry 모드: 원격 카탈로그 fetch → prefix version lifecycle 검증 → 생성.
- catalog 모드: 로컬 Catalog(TS/JS/JSON) 로드 → 생성.
- CLI는 `cli-contract-spec`이 정의한 관측 도구와 같은 실행 모델을 사용해 실패 지점을 추적 가능하게 남긴다.

## 파이프라인 제약

- 생성물은 같은 catalog contentHash를 공유해야 한다.
- 확장 포인트는 생성 단계 사이에만 허용하고, catalog 파싱 규칙 자체는 분기시키지 않는다.
- 실패 시 부분 생성물을 남기기보다 전체 배치를 다시 생성하는 편이 drift를 줄인다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test codegen
```
