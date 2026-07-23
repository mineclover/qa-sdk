---
def:
  id: provider-tokenizer-openai-gpt-4o
  type: spec
  tier: component
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [context, provider, tokenizer, openai]
  links:
    - target: context-bounded-execution
      type: depends_on
    - target: context-bounded-execution-cases-provider-tokenizer
      type: implements
sources:
  - packages/provider-tokenizer-openai/src/index.ts
  - packages/provider-tokenizer-openai/src/index.test.ts
  - packages/provider-tokenizer-openai/fixtures/gpt-4o.registry.json
---

# OpenAI gpt-4o Tokenizer Module

## 목적 ^purpose

OpenAI `gpt-4o`의 model-specific encoding을 qa-sdk bounded context의 provider-neutral `ContextTokenCounter` module contract에 연결한다.

## 계약 ^defines

- provider identity는 `openai`로 고정한다.
- model identity는 `gpt-4o`로 고정한다.
- tokenizer revision은 `js-tiktoken@1.0.21`로 결과와 usage event에 보존한다.
- 문자열은 그대로, 그 외 canonical value는 정렬된 JSON으로 직렬화한 뒤 encoding한다.
- `phase`, `routeKey`, `factKey` context는 받지만 provider tokenizer 계산 자체의 identity를 변경하지 않는다.

## 경계 ^boundary

이 패키지는 composition root integration이며 `context-runtime`과 OpenAI SDK를 직접 연결하지 않는다. registry는 이 패키지의 built ESM module을 선택하고, runtime은 provider/model/revision이 보존된 neutral counter만 받는다.

## 검증 ^validation

- package build/typecheck/test가 model identity, deterministic serialization, measured count를 검증한다.
- `fixtures/gpt-4o.registry.json`은 registry 선택 경로의 실제 module entrypoint다.
