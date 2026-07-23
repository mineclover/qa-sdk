# @qa-sdk/provider-tokenizer-openai

OpenAI `gpt-4o`용 bounded-context tokenizer composition-root module이다.

```bash
corepack pnpm --filter @qa-sdk/provider-tokenizer-openai build
qa-sdk def context definition-addressing --bounded \
  --tokenizer-registry packages/provider-tokenizer-openai/fixtures/gpt-4o.registry.json \
  --tokenizer-provider openai \
  --tokenizer-model gpt-4o \
  --json
```

모듈은 `js-tiktoken`의 model-specific encoding을 사용하고, qa-sdk가 전달하는
canonical route/Facts 값을 결정론적 JSON으로 직렬화한 뒤 토큰 수를 계산한다.
provider API의 message framing은 이 모듈의 책임이 아니며, 별도 API 호출 비용은
provider usage envelope로 측정한다.
