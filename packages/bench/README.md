# @qa-sdk/bench

`QaLogger` / `qa-bridge` 기반 서비스 벤치마크 하네스.

## 목적

- transport microbench와 분리된 서비스 시나리오 벤치 수행
- `QaLogger`의 batch/flush/error path를 실제 사용 방식으로 측정
- `qa-bridge` 같은 facade를 그대로 감싸서 계측 코드 재사용

## 구성

- `createQaLoggerBenchmarkHarness()` — `QaLogger` 직접 측정용 하네스
- `createBridgeBenchmarkHarness()` — 기존 `qa-bridge` facade 어댑터
- `createBenchmarkQaContext()` — `qa-context` 기반 서비스 좌표 helper
- `createSequenceScenario()` — 선언형 시나리오 빌더
- `createCheckoutScenario()` / `createSearchScenario()` / `createLoginScenario()` — 기본 시나리오
- `runBenchmark()` — warmup + concurrency + 요약 통계 실행기
- `renderBenchmarkReport()` — 사람이 읽는 report 렌더러
- `qa-bench` — 실행용 CLI

## 예시

```ts
import { NoopTransport } from "@qa-sdk/sdk";
import {
  createCheckoutScenario,
  createQaLoggerBenchmarkHarness,
  runBenchmark,
} from "@qa-sdk/bench";

const summary = await runBenchmark({
  scenario: createCheckoutScenario(),
  concurrency: 4,
  warmupIterations: 2,
  measuredIterations: 20,
  harnessFactory: () =>
    createQaLoggerBenchmarkHarness({
      transport: new NoopTransport(),
      owner: { owner_type: "workspace", owner_id: "qa-sdk" },
      source: {
        service_name: "checkout-bench",
        sdk_name: "@qa-sdk/bench",
        sdk_version: "0.1.0",
      },
      runtime: { platform: "node", os_version: process.version },
      build: { env: "dev" },
      batchSize: 8,
      flushIntervalMs: 0,
    }),
});

console.log(summary);
```

## CLI

```bash
pnpm --filter @qa-sdk/bench build
node packages/bench/dist/cli.js \
  --scenario checkout \
  --concurrency 2 \
  --iterations 10 \
  --warmup 2 \
  --transport noop \
  --service shopping-web \
  --namespace shop \
  --env dev \
  --region asia \
  --format markdown
```
