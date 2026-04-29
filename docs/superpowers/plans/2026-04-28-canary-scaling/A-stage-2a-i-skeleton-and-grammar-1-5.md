## 단계 2: sim-identifier-grammar 패키지 + identifier-gate CI

**Spec 참조:** `03-identifier-grammar.md` 전체

식별자 15종 builder/parser/Zod를 구현하고, 라운드트립 property test로 보장하며, CI gate에서 코드/yaml/env를 정적 린트한다.

### Task 2.1: 패키지 골격 생성

**Files:**
- Create: `packages/sim-identifier-grammar/package.json`
- Create: `packages/sim-identifier-grammar/tsup.config.ts`
- Create: `packages/sim-identifier-grammar/tsconfig.json`
- Create: `packages/sim-identifier-grammar/vitest.config.ts`
- Create: `packages/sim-identifier-grammar/src/index.ts` (빈 파일로 시작)

- [ ] **Step 2.1.1: package.json (ralph-tui-integration 패턴 그대로)**

`packages/sim-identifier-grammar/package.json`:

```json
{
  "name": "sim-identifier-grammar",
  "version": "0.1.0",
  "description": "enterprise-pm 시뮬 식별자 합성/역분해/검증 grammar",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "ulid": "^2.3.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "fast-check": "^3.23.2",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2.1.2: tsup.config.ts**

`packages/sim-identifier-grammar/tsup.config.ts`:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  target: "es2023",
  platform: "node",
  ignoreWatch: ["**/*.test.ts"],
});
```

- [ ] **Step 2.1.3: tsconfig.json**

`packages/sim-identifier-grammar/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 2.1.4: vitest.config.ts**

`packages/sim-identifier-grammar/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["dist/**"],
    passWithNoTests: false,
  },
});
```

- [ ] **Step 2.1.5: 빈 src/index.ts**

`packages/sim-identifier-grammar/src/index.ts`:

```typescript
// sim-identifier-grammar — 시뮬 식별자 합성/역분해/검증 grammar 진입점.
// 본 파일은 builder/parser/Zod schema 모듈을 한 곳에서 re-export 한다.
// 자세한 정의는 spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md
export {};
```

- [ ] **Step 2.1.6: 패키지 install + 빌드 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm install
pnpm --filter sim-identifier-grammar build
```

기대: `dist/index.{js,cjs,d.ts}` 생성, 에러 없음.

- [ ] **Step 2.1.7: Commit**

```bash
git add packages/sim-identifier-grammar/
git commit -m "feat(sim-identifier-grammar): package skeleton (tsup ESM+CJS dual)"
```

### Task 2.2: 식별자 #1 service prefix builder/parser/Zod + roundtrip test

**Files:**
- Create: `packages/sim-identifier-grammar/src/service-prefix.ts`
- Create: `packages/sim-identifier-grammar/src/service-prefix.test.ts`

- [ ] **Step 2.2.1: 실패 테스트 작성 (test-first)**

`packages/sim-identifier-grammar/src/service-prefix.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildServicePrefix,
  parseServicePrefix,
  ServicePrefixSchema,
  type ServicePrefix,
} from "./service-prefix.js";

describe("service prefix grammar (#1)", () => {
  it("builds canonical sim.svc.approval", () => {
    const out = buildServicePrefix({
      namespace: "sim",
      category: "svc",
      name: "approval",
    });
    expect(out).toBe("sim.svc.approval");
  });

  it("parses sim.svc.approval back to original shape", () => {
    const orig = { namespace: "sim", category: "svc", name: "approval" } as const;
    expect(parseServicePrefix(buildServicePrefix(orig))).toEqual(orig);
  });

  it("rejects unknown namespace", () => {
    expect(() =>
      buildServicePrefix({ namespace: "prod" as never, category: "svc", name: "x" }),
    ).toThrow();
  });

  it("rejects name with uppercase", () => {
    expect(() => buildServicePrefix({ namespace: "sim", category: "svc", name: "Approval" }))
      .toThrow();
  });

  it("Zod schema accepts valid string", () => {
    expect(() => ServicePrefixSchema.parse("sim.svc.approval")).not.toThrow();
  });

  it("Zod schema rejects invalid category", () => {
    expect(() => ServicePrefixSchema.parse("sim.unknown.x")).toThrow();
  });

  it("roundtrip property: build∘parse = id", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("svc", "slice", "evt", "cache"),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (category, name) => {
          const orig: ServicePrefix = { namespace: "sim", category, name };
          expect(parseServicePrefix(buildServicePrefix(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.2.2: 테스트 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm --filter sim-identifier-grammar test service-prefix
```

기대: 모든 테스트가 "module not found" 또는 export 미정의로 FAIL.

- [ ] **Step 2.2.3: 최소 구현**

`packages/sim-identifier-grammar/src/service-prefix.ts`:

```typescript
import { z } from "zod";

export const SERVICE_PREFIX_NAMESPACES = ["sim"] as const;
export const SERVICE_PREFIX_CATEGORIES = ["svc", "slice", "evt", "cache"] as const;
const NAME_REGEX = /^[a-z][a-z0-9-]{0,30}$/;

export type ServicePrefixNamespace = (typeof SERVICE_PREFIX_NAMESPACES)[number];
export type ServicePrefixCategory = (typeof SERVICE_PREFIX_CATEGORIES)[number];

export interface ServicePrefix {
  namespace: ServicePrefixNamespace;
  category: ServicePrefixCategory;
  name: string;
}

const ServicePrefixInputSchema = z.object({
  namespace: z.enum(SERVICE_PREFIX_NAMESPACES),
  category: z.enum(SERVICE_PREFIX_CATEGORIES),
  name: z.string().regex(NAME_REGEX),
});

export const ServicePrefixSchema = z
  .string()
  .regex(/^sim\.(svc|slice|evt|cache)\.[a-z][a-z0-9-]{0,30}$/, {
    message: "invalid service prefix",
  });

export function buildServicePrefix(input: ServicePrefix): string {
  const v = ServicePrefixInputSchema.parse(input);
  return `${v.namespace}.${v.category}.${v.name}`;
}

export function parseServicePrefix(s: string): ServicePrefix {
  ServicePrefixSchema.parse(s);
  const [namespace, category, name] = s.split(".") as [
    ServicePrefixNamespace,
    ServicePrefixCategory,
    string,
  ];
  return { namespace, category, name };
}
```

- [ ] **Step 2.2.4: 테스트 통과 확인**

```bash
pnpm --filter sim-identifier-grammar test service-prefix
```

기대: 7 PASS.

- [ ] **Step 2.2.5: index.ts에 re-export 추가**

`packages/sim-identifier-grammar/src/index.ts` 수정:

```typescript
// sim-identifier-grammar — 시뮬 식별자 합성/역분해/검증 grammar 진입점.
// 자세한 정의는 spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md

export {
  buildServicePrefix,
  parseServicePrefix,
  ServicePrefixSchema,
  SERVICE_PREFIX_NAMESPACES,
  SERVICE_PREFIX_CATEGORIES,
  type ServicePrefix,
  type ServicePrefixNamespace,
  type ServicePrefixCategory,
} from "./service-prefix.js";
```

- [ ] **Step 2.2.6: Commit**

```bash
git add packages/sim-identifier-grammar/src/service-prefix.ts \
        packages/sim-identifier-grammar/src/service-prefix.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #1 service prefix builder/parser/Zod"
```

### Task 2.3: 식별자 #2 version tag

**Files:**
- Create: `packages/sim-identifier-grammar/src/version-tag.ts`
- Create: `packages/sim-identifier-grammar/src/version-tag.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

- [ ] **Step 2.3.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/version-tag.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildVersionTag,
  parseVersionTag,
  VersionTagSchema,
  type VersionTag,
} from "./version-tag.js";

describe("version tag grammar (#2)", () => {
  it("stable: { value:3, state:stable } → 'v3'", () => {
    expect(buildVersionTag({ axis: "version", value: 3, state: "stable" })).toBe("v3");
  });

  it("candidate: { value:4, state:candidate } → 'v4-candidate'", () => {
    expect(buildVersionTag({ axis: "version", value: 4, state: "candidate" })).toBe("v4-candidate");
  });

  it("retired uses 'vN-retired' suffix", () => {
    expect(buildVersionTag({ axis: "version", value: 1, state: "retired" })).toBe("v1-retired");
  });

  it("parses 'v3' to stable", () => {
    expect(parseVersionTag("v3")).toEqual({ axis: "version", value: 3, state: "stable" });
  });

  it("parses 'v4-candidate' to candidate", () => {
    expect(parseVersionTag("v4-candidate")).toEqual({ axis: "version", value: 4, state: "candidate" });
  });

  it("rejects negative value", () => {
    expect(() =>
      buildVersionTag({ axis: "version", value: -1, state: "stable" }),
    ).toThrow();
  });

  it("rejects 'v0' (must be ≥ 1)", () => {
    expect(() => parseVersionTag("v0")).toThrow();
  });

  it("Zod schema accepts canonical strings", () => {
    expect(() => VersionTagSchema.parse("v3")).not.toThrow();
    expect(() => VersionTagSchema.parse("v4-candidate")).not.toThrow();
  });

  it("roundtrip property: parse∘build = id", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom("stable", "candidate", "retired"),
        (value, state) => {
          const orig: VersionTag = { axis: "version", value, state };
          expect(parseVersionTag(buildVersionTag(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.3.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test version-tag
```

기대: FAIL (모듈 미정의).

- [ ] **Step 2.3.3: 최소 구현**

`packages/sim-identifier-grammar/src/version-tag.ts`:

```typescript
import { z } from "zod";

export const VERSION_TAG_STATES = ["stable", "candidate", "retired"] as const;
export type VersionTagState = (typeof VERSION_TAG_STATES)[number];

export interface VersionTag {
  axis: "version";
  value: number;
  state: VersionTagState;
}

const VersionTagInputSchema = z.object({
  axis: z.literal("version"),
  value: z.number().int().positive(),
  state: z.enum(VERSION_TAG_STATES),
});

export const VersionTagSchema = z
  .string()
  .regex(/^v[1-9][0-9]*(-candidate|-retired)?$/, { message: "invalid version tag" });

export function buildVersionTag(input: VersionTag): string {
  const v = VersionTagInputSchema.parse(input);
  if (v.state === "stable") return `v${v.value}`;
  return `v${v.value}-${v.state}`;
}

export function parseVersionTag(s: string): VersionTag {
  VersionTagSchema.parse(s);
  const m = s.match(/^v([1-9][0-9]*)(?:-(candidate|retired))?$/)!;
  const value = Number(m[1]);
  const state: VersionTagState = (m[2] as VersionTagState) ?? "stable";
  return { axis: "version", value, state };
}
```

- [ ] **Step 2.3.4: 테스트 통과 확인**

```bash
pnpm --filter sim-identifier-grammar test version-tag
```

기대: 9 PASS.

- [ ] **Step 2.3.5: index.ts re-export + Commit**

`src/index.ts`에 다음 추가:

```typescript
export {
  buildVersionTag,
  parseVersionTag,
  VersionTagSchema,
  VERSION_TAG_STATES,
  type VersionTag,
  type VersionTagState,
} from "./version-tag.js";
```

```bash
git add packages/sim-identifier-grammar/src/version-tag.ts \
        packages/sim-identifier-grammar/src/version-tag.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #2 version tag builder/parser/Zod"
```

### Task 2.4 ~ 2.16: 나머지 식별자 13종

**구조는 Task 2.2/2.3과 동일하다.** 각 식별자 1개당 4개 step (test → fail → impl → pass + index re-export + commit). spec `03-identifier-grammar.md` §2.3 ~ §2.15에 정의된 원형/합성 규칙/예시를 그대로 옮겨서 코드로 반영한다.

각 task의 정확한 builder/parser 시그니처와 테스트 fixture는 spec §2.N에서 인용하되, 본 plan의 뒷 단계에서 dispatching-parallel-agents로 병렬 작성할 수 있도록 *task index만 미리 고정*한다:

| Task | 식별자 | spec §  | 입력 형식 |
|---|---|---|---|
| 2.4 | #3 image tag | §2.3 | `{ registry, servicePrefix, versionTag }` → `qa-sdk/sim-approval-api:v3` |
| 2.5 | #4 HTTP header | §2.4 | `{ kind:"header", domain, attr }` → `x-canary-stage` |
| 2.6 | #5 outbox event name | §2.5 | `{ domain, aggregate, verbPast }` → `approval.budget.submitted` |
| 2.7 | #6 outbox schemaHash | §2.6 | `{ eventName, payloadShape }` → 16-char sha256 |
| 2.8 | #7 decision id | §2.7 | `{ pass, cycleId }` → `safety-decision-01HXX...` |
| 2.9 | #8 cycle id | §2.8 | ULID (controllerId 임베드) |
| 2.10 | #9 label key | §2.9 | `{ namespace, key }` → `sim.role` |
| 2.11 | #10 redis pub/sub channel | §2.10 | `{ namespace, topic }` → `sim:bitmap.invalidate` |
| 2.12 | #11 bitmap cache key | §2.11 | `{ scope, id, prefix, version }` → `bitmap:user:42:sim.bitmap:v1` |
| 2.13 | #12 outbox idempotency key | §2.12 | `{ aggregateId, eventName, occurredAt }` |
| 2.14 | #13 replication slot | §2.13 | `{ purpose }` → `sim_read_replica_slot` |
| 2.15 | #14 decision category | §2.14 | `{ pass, name }` → `safety.compatibility` |
| 2.16 | #15 decision signal | §2.15 | `{ category, signal }` → `compatibility.schemaCompatRate` |

**Task 2.4~2.16 공통 step pattern:**

각 식별자 task는 다음 5개 step으로 구성한다 (Task 2.2의 형식과 동일).

- [ ] **Step N.1: spec §2.M의 원형 정의·합성 규칙·예시·잘못된 예시를 그대로 가져와 vitest + fast-check 테스트 작성** (`packages/sim-identifier-grammar/src/<name>.test.ts`)
- [ ] **Step N.2: 테스트 실패 확인** (`pnpm --filter sim-identifier-grammar test <name>`)
- [ ] **Step N.3: builder/parser/Zod 최소 구현** (`packages/sim-identifier-grammar/src/<name>.ts`)
- [ ] **Step N.4: 테스트 통과 확인 + index.ts re-export 추가**
- [ ] **Step N.5: Commit (`feat(sim-identifier-grammar): #N <id-name> builder/parser/Zod`)**

본 plan에서는 Task 2.4의 코드 블록 1개만 모범 사례로 풀어 작성한다. Task 2.5~2.16은 같은 형식이므로 본 plan 단계에서는 spec §2.M 인용을 따라 dispatching-parallel-agents 또는 subagent-driven-development로 위임한다.

### Task 2.4: 식별자 #3 image tag (모범 사례)

**Files:**
- Create: `packages/sim-identifier-grammar/src/image-tag.ts`
- Create: `packages/sim-identifier-grammar/src/image-tag.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

이 식별자는 service prefix(#1)와 version tag(#2)를 입력으로 받으므로 의존 검증을 포함한다.

- [ ] **Step 2.4.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/image-tag.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildImageTag, parseImageTag, type ImageTag } from "./image-tag.js";

describe("image tag grammar (#3)", () => {
  it("builds qa-sdk/sim-approval-api:v3", () => {
    const out = buildImageTag({
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
      versionTag: { axis: "version", value: 3, state: "stable" },
    });
    expect(out).toBe("qa-sdk/sim-approval-api:v3");
  });

  it("derives image name from prefix: sim.svc.approval → sim-approval-api", () => {
    const out = buildImageTag({
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "auth" },
      versionTag: { axis: "version", value: 1, state: "candidate" },
    });
    expect(out).toBe("qa-sdk/sim-auth-api:v1-candidate");
  });

  it("rejects unknown registry", () => {
    expect(() =>
      buildImageTag({
        registry: "untrusted" as never,
        servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
        versionTag: { axis: "version", value: 1, state: "stable" },
      }),
    ).toThrow();
  });

  it("rejects non-svc category in image tag context", () => {
    expect(() =>
      buildImageTag({
        registry: "qa-sdk",
        servicePrefix: { namespace: "sim", category: "evt", name: "approval" },
        versionTag: { axis: "version", value: 1, state: "stable" },
      }),
    ).toThrow();
  });

  it("parses qa-sdk/sim-approval-api:v3 back to original shape", () => {
    const orig: ImageTag = {
      registry: "qa-sdk",
      servicePrefix: { namespace: "sim", category: "svc", name: "approval" },
      versionTag: { axis: "version", value: 3, state: "stable" },
    };
    expect(parseImageTag(buildImageTag(orig))).toEqual(orig);
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
        fc.integer({ min: 1, max: 999 }),
        fc.constantFrom("stable", "candidate", "retired"),
        (name, value, state) => {
          const orig: ImageTag = {
            registry: "qa-sdk",
            servicePrefix: { namespace: "sim", category: "svc", name },
            versionTag: { axis: "version", value, state },
          };
          expect(parseImageTag(buildImageTag(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.4.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test image-tag
```

기대: FAIL.

- [ ] **Step 2.4.3: 최소 구현**

`packages/sim-identifier-grammar/src/image-tag.ts`:

```typescript
import { z } from "zod";
import {
  buildServicePrefix,
  parseServicePrefix,
  type ServicePrefix,
} from "./service-prefix.js";
import {
  buildVersionTag,
  parseVersionTag,
  type VersionTag,
} from "./version-tag.js";

export const IMAGE_REGISTRIES = ["qa-sdk"] as const;
export type ImageRegistry = (typeof IMAGE_REGISTRIES)[number];

export interface ImageTag {
  registry: ImageRegistry;
  servicePrefix: ServicePrefix;
  versionTag: VersionTag;
}

const ImageTagInputSchema = z.object({
  registry: z.enum(IMAGE_REGISTRIES),
  servicePrefix: z.object({
    namespace: z.literal("sim"),
    category: z.literal("svc"),
    name: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
  }),
  versionTag: z.object({
    axis: z.literal("version"),
    value: z.number().int().positive(),
    state: z.enum(["stable", "candidate", "retired"]),
  }),
});

function prefixToImageName(p: ServicePrefix): string {
  // sim.svc.approval → sim-approval-api
  return `${p.namespace}-${p.name}-api`;
}

function imageNameToPrefix(image: string): ServicePrefix {
  // sim-approval-api → { sim, svc, approval }
  const m = image.match(/^sim-([a-z][a-z0-9-]{0,30})-api$/);
  if (!m) throw new Error(`invalid image name: ${image}`);
  return { namespace: "sim", category: "svc", name: m[1] };
}

export function buildImageTag(input: ImageTag): string {
  const v = ImageTagInputSchema.parse(input);
  const prefixStr = buildServicePrefix(v.servicePrefix); // 검증
  void prefixStr;
  const versionStr = buildVersionTag(v.versionTag);
  return `${v.registry}/${prefixToImageName(v.servicePrefix)}:${versionStr}`;
}

export function parseImageTag(s: string): ImageTag {
  const m = s.match(/^([a-z][a-z0-9-]+)\/([a-z0-9-]+):(.+)$/);
  if (!m) throw new Error(`invalid image tag: ${s}`);
  const [, registry, image, version] = m;
  if (!IMAGE_REGISTRIES.includes(registry as ImageRegistry)) {
    throw new Error(`unknown registry: ${registry}`);
  }
  const servicePrefix = imageNameToPrefix(image);
  const versionTag = parseVersionTag(version);
  return {
    registry: registry as ImageRegistry,
    servicePrefix,
    versionTag,
  };
}

export { parseServicePrefix }; // for downstream test convenience
```

- [ ] **Step 2.4.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test image-tag
```

기대: 6 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildImageTag,
  parseImageTag,
  IMAGE_REGISTRIES,
  type ImageTag,
  type ImageRegistry,
} from "./image-tag.js";
```

- [ ] **Step 2.4.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/image-tag.ts \
        packages/sim-identifier-grammar/src/image-tag.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #3 image tag (with #1/#2 composition)"
```

### Task 2.5: 식별자 #4 HTTP header

**Files:**
- Create: `packages/sim-identifier-grammar/src/http-header.ts`
- Create: `packages/sim-identifier-grammar/src/http-header.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

본 식별자는 다른 식별자에 의존하지 않는 단독 grammar이며, 합성 형태가 `x-${domain}-${attr}` 고정 prefix(`x-`)를 갖는 점이 특이하다. allowlist는 `simulations/enterprise-pm/contracts/header-vocabulary.catalog.ts`(Task 2.17에서 생성)이지만 본 task에서는 builder/parser/Zod의 grammar 단위 정확성만 책임진다.

- [ ] **Step 2.5.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/http-header.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildHttpHeader,
  parseHttpHeader,
  type HttpHeader,
} from "./http-header.js";

describe("HTTP header grammar (#4)", () => {
  it("builds x-canary-stage from canonical input", () => {
    const out = buildHttpHeader({
      kind: "header",
      domain: "canary",
      attr: "stage",
    });
    expect(out).toBe("x-canary-stage");
  });

  it("builds x-trace-decision-id (multi-segment attr)", () => {
    const out = buildHttpHeader({
      kind: "header",
      domain: "trace",
      attr: "decision-id",
    });
    expect(out).toBe("x-trace-decision-id");
  });

  it("parses x-service-version back to original shape", () => {
    const orig: HttpHeader = {
      kind: "header",
      domain: "service",
      attr: "version",
    };
    expect(parseHttpHeader(buildHttpHeader(orig))).toEqual(orig);
  });

  it("rejects domain outside allowlist", () => {
    expect(() =>
      buildHttpHeader({
        kind: "header",
        domain: "auth" as never,
        attr: "token",
      }),
    ).toThrow();
  });

  it("rejects PascalCase attr (kebab-case 위반)", () => {
    expect(() =>
      buildHttpHeader({
        kind: "header",
        domain: "canary",
        attr: "Stage" as never,
      }),
    ).toThrow();
  });

  it("rejects parsing of X-Canary-Stage (case 위반)", () => {
    expect(() => parseHttpHeader("X-Canary-Stage")).toThrow();
  });

  it("rejects parsing of header without x- prefix", () => {
    expect(() => parseHttpHeader("canary-stage")).toThrow();
  });

  it("rejects parsing of header with unknown domain", () => {
    expect(() => parseHttpHeader("x-auth-token")).toThrow();
  });

  it("roundtrip property", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("service", "canary", "trace", "sim"),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (domain, attr) => {
          const orig: HttpHeader = { kind: "header", domain, attr };
          expect(parseHttpHeader(buildHttpHeader(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.5.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test http-header
```

기대: FAIL (모듈 미존재).

- [ ] **Step 2.5.3: 최소 구현**

`packages/sim-identifier-grammar/src/http-header.ts`:

```typescript
import { z } from "zod";

export const HEADER_DOMAINS = ["service", "canary", "trace", "sim"] as const;
export type HeaderDomain = (typeof HEADER_DOMAINS)[number];

export interface HttpHeader {
  kind: "header";
  domain: HeaderDomain;
  attr: string; // kebab-case
}

// 입력 원형 검증
export const HttpHeaderSchema = z.object({
  kind: z.literal("header"),
  domain: z.enum(HEADER_DOMAINS),
  attr: z.string().regex(/^[a-z][a-z0-9-]*$/),
});

// 합성 결과 검증 (x-${domain}-${attr})
const HEADER_NAME_PATTERN =
  /^x-(service|canary|trace|sim)-([a-z][a-z0-9-]*)$/;
export const HttpHeaderNameSchema = z.string().regex(HEADER_NAME_PATTERN);

export function buildHttpHeader(input: HttpHeader): string {
  const v = HttpHeaderSchema.parse(input);
  const out = `x-${v.domain}-${v.attr}`;
  return HttpHeaderNameSchema.parse(out);
}

export function parseHttpHeader(s: string): HttpHeader {
  const m = HEADER_NAME_PATTERN.exec(s);
  if (!m) throw new Error(`invalid HTTP header name: ${s}`);
  return {
    kind: "header",
    domain: m[1] as HeaderDomain,
    attr: m[2],
  };
}
```

- [ ] **Step 2.5.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test http-header
```

기대: 9 PASS.

`src/index.ts`에 추가:
```typescript
export {
  buildHttpHeader,
  parseHttpHeader,
  HttpHeaderSchema,
  HttpHeaderNameSchema,
  HEADER_DOMAINS,
  type HttpHeader,
  type HeaderDomain,
} from "./http-header.js";
```

- [ ] **Step 2.5.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/http-header.ts \
        packages/sim-identifier-grammar/src/http-header.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #4 HTTP header builder/parser/Zod"
```

### Task 2.6: 식별자 #5 outbox event name

**Files:**
- Create: `packages/sim-identifier-grammar/src/event-name.ts`
- Create: `packages/sim-identifier-grammar/src/event-name.test.ts`
- Modify: `packages/sim-identifier-grammar/src/index.ts`

이 식별자는 spec 03 §2.5 outbox event name을 구현한다. 원형은 `{ domain, aggregate, verbPast }`이고 합성은 `${domain}.${aggregate}.${verbPast}` (예: `approval.budget.submitted`). domain/aggregate/verbPast 어휘는 `simulations/enterprise-pm/contracts/event-vocabulary.catalog.ts`에 등록된 값만 허용하며, builder는 catalog의 domain×aggregate 매트릭스를 참조하여 잘못된 조합(예: `approval` + `user`)을 거부한다.

- [ ] **Step 2.6.1: 실패 테스트 작성**

`packages/sim-identifier-grammar/src/event-name.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildEventName, parseEventName, type EventName } from "./event-name.js";
import {
  EVENT_DOMAINS,
  EVENT_AGGREGATES_BY_DOMAIN,
  EVENT_VERBS_PAST,
} from "../../../simulations/enterprise-pm/contracts/event-vocabulary.catalog.js";

describe("outbox event name grammar (#5)", () => {
  it("builds approval.budget.submitted", () => {
    const out = buildEventName({
      domain: "approval",
      aggregate: "budget",
      verbPast: "submitted",
    });
    expect(out).toBe("approval.budget.submitted");
  });

  it("parses pm.task.completed back to original shape", () => {
    const orig: EventName = { domain: "pm", aggregate: "task", verbPast: "completed" };
    expect(parseEventName(buildEventName(orig))).toEqual(orig);
  });

  it("rejects unknown domain", () => {
    expect(() =>
      buildEventName({ domain: "billing" as never, aggregate: "budget", verbPast: "submitted" }),
    ).toThrow();
  });

  it("rejects aggregate not registered for the domain (approval+user)", () => {
    expect(() =>
      buildEventName({ domain: "approval", aggregate: "user", verbPast: "submitted" }),
    ).toThrow();
  });

  it("rejects verbPast not in catalog (current-tense submit)", () => {
    expect(() =>
      buildEventName({ domain: "approval", aggregate: "budget", verbPast: "submit" as never }),
    ).toThrow();
  });

  it("parser rejects non 3-tier strings", () => {
    expect(() => parseEventName("approval.budget")).toThrow();
    expect(() => parseEventName("approval.budget.submitted.extra")).toThrow();
  });

  it("roundtrip property over catalog combinations", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVENT_DOMAINS),
        fc.constantFrom(...EVENT_VERBS_PAST),
        fc.integer({ min: 0, max: 1_000_000 }),
        (domain, verbPast, seed) => {
          const aggregates = EVENT_AGGREGATES_BY_DOMAIN[domain];
          const aggregate = aggregates[seed % aggregates.length];
          const orig: EventName = { domain, aggregate, verbPast };
          expect(parseEventName(buildEventName(orig))).toEqual(orig);
        },
      ),
      { numRuns: 200 },
    );
  });
});
```

- [ ] **Step 2.6.2: 테스트 실패 확인**

```bash
pnpm --filter sim-identifier-grammar test event-name
```

기대: FAIL.

- [ ] **Step 2.6.3: 최소 구현**

`packages/sim-identifier-grammar/src/event-name.ts`:

```typescript
import { z } from "zod";
import {
  EVENT_DOMAINS,
  EVENT_AGGREGATES_BY_DOMAIN,
  EVENT_VERBS_PAST,
  type EventDomain,
  type EventVerbPast,
} from "../../../simulations/enterprise-pm/contracts/event-vocabulary.catalog.js";

export interface EventName {
  domain: EventDomain;
  aggregate: string;
  verbPast: EventVerbPast;
}

const EventNameInputSchema = z
  .object({
    domain: z.enum(EVENT_DOMAINS),
    aggregate: z.string().regex(/^[a-z][a-z0-9-]*$/),
    verbPast: z.enum(EVENT_VERBS_PAST),
  })
  .superRefine((v, ctx) => {
    const allowed = EVENT_AGGREGATES_BY_DOMAIN[v.domain];
    if (!allowed.includes(v.aggregate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregate"],
        message: `aggregate "${v.aggregate}" not registered for domain "${v.domain}" (allowed: ${allowed.join(", ")})`,
      });
    }
  });

export function buildEventName(input: EventName): string {
  const v = EventNameInputSchema.parse(input);
  return `${v.domain}.${v.aggregate}.${v.verbPast}`;
}

export function parseEventName(s: string): EventName {
  const parts = s.split(".");
  if (parts.length !== 3) throw new Error(`invalid event name (must be 3-tier): ${s}`);
  const [domain, aggregate, verbPast] = parts;
  return EventNameInputSchema.parse({ domain, aggregate, verbPast }) as EventName;
}
```

- [ ] **Step 2.6.4: 테스트 통과 + index re-export**

```bash
pnpm --filter sim-identifier-grammar test event-name
```

기대: 7 PASS.

`src/index.ts`에 추가:
```typescript
export { buildEventName, parseEventName, type EventName } from "./event-name.js";
```

- [ ] **Step 2.6.5: Commit**

```bash
git add packages/sim-identifier-grammar/src/event-name.ts \
        packages/sim-identifier-grammar/src/event-name.test.ts \
        packages/sim-identifier-grammar/src/index.ts
git commit -m "feat(sim-identifier-grammar): #5 outbox event name builder/parser/Zod"
```

