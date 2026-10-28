# Library Boundary — `process.env` 금지 + forRoot Config

> 슬라이스 모듈은 라이브러리다. **환경변수를 직접 읽지 않는다.** 서비스 부팅부가 zod 로 파싱하여 슬라이스의 `forRoot(config)` 에 주입한다.

## 1. 컨벤션 (CLAUDE.md 의 환경변수 룰 재진술)

| 계층 | `process.env` 직접 접근 | 비고 |
|---|---|---|
| 서비스 (`services/<svc>/src/config/env.ts`) | 허용 (zod 스키마 필수) | 부팅부 단일 진입점 |
| SDK / context | 허용 (`process.env.QA_*` fallback) | 호환 목적 |
| CLI / 테스트 | 허용 | |
| **슬라이스 / 라이브러리** | **금지** | constructor 인자 / forRoot 주입 |
| 브라우저 | 금지 | |

## 2. 안티 패턴 (실증)

마이그레이션 전 `bitmap.module.ts` (commit `e47282e0` 이전):

```ts
// 위반 — 슬라이스 모듈이 직접 env 파싱
const env = bitmapEnvSchema.parse(process.env);
const provider = { provide: BITMAP_ISSUER, useValue: createIssuer(env) };
```

문제:
- 슬라이스가 환경 결정에 묶임 — 시나리오 / 테스트 환경에서 env 우회 어려움.
- 같은 슬라이스를 여러 컨텍스트에서 다른 설정으로 부팅 불가.
- CLAUDE.md 컨벤션 위반 — 라이브러리 경계 침범.

## 3. 정답 패턴 — `forRoot(config)` (commit `e47282e0` 이후)

`simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap.module.ts`

```ts
@Module({})
export class BitmapSliceModule {
  static forRoot(config: BitmapIssuerConfig): DynamicModule {
    const issuerConfigProvider: Provider = {
      provide: BITMAP_ISSUER_CONFIG,
      useValue: config,
    };
    return {
      module: BitmapSliceModule,
      imports: [UserSliceModule, RoleSliceModule, RoleAssignmentSliceModule],
      providers: [issuerConfigProvider, /* ... */],
      controllers: [BitmapController],
      exports: [BitmapIssueQuery],
    };
  }
}
```

서비스 부팅부 (`services/auth-api/src/main.ts` 또는 root module):

```ts
import { buildBitmapIssuerConfig } from "./config/env.js"; // zod 파싱 결과
BitmapSliceModule.forRoot(buildBitmapIssuerConfig(env));
```

핵심:
- 슬라이스는 `BitmapIssuerConfig` 추상 타입만 받음. env 인지 zero.
- `forRoot` 호출이 슬라이스의 **유일한 진입점** — 정적 import 시도는 `BITMAP_ISSUER_CONFIG` 미주입으로 부팅 실패.
- 시나리오 / 테스트는 임의의 config 객체 주입 가능.

## 4. 다른 슬라이스 모듈 패턴

| 슬라이스 | 진입점 | 비고 |
|---|---|---|
| 단순 슬라이스 (대부분) | `@Module({})` 정적 + DI 토큰 주입 | env 의존 없음 |
| Issuer / 외부 자원 사용 | `static forRoot(config)` DynamicModule | bitmap 패턴 |
| 외부 client 주입 | `static forRoot({ httpClient })` | composition root 가 client 인스턴스 주입 |

## 5. zod env 스키마 위치

`services/<svc>/src/config/env.ts` — 서비스당 단일 파일:

```ts
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  AUTH_API_BASE_URL: z.string().url().optional(),
  // ...
});

export type Env = z.infer<typeof envSchema>;

export function buildBitmapIssuerConfig(env: Env): BitmapIssuerConfig {
  // env → 슬라이스 config 변환 책임은 부팅부에 둔다
}
```

## 6. 검증

- `pnpm --filter @qa-sdk/sim-scenarios test` — 시나리오에서 슬라이스를 다른 config 로 부팅하는 케이스가 통과하는지.
- 코드 리뷰: 슬라이스 모듈 (`*.module.ts`, `application/`, `infrastructure/`) 에서 `process.env` 접근 grep — 없어야 함.

## 7. 참조

- CLAUDE.md "환경변수 처리" 섹션
- `simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap.module.ts` — forRoot 실증
- `docs/plan/simulations-domain-slice-migration/lessons-learned.md` §3 — B6 commit `e47282e0`
- `architecture-samples/domain-slice-monorepo/docs/source-architecture/current/04-governance-logging-testing-bff.md` — governance 일반론
