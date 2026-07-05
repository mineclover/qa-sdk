# Taxonomy Engine v0.1 — Task 0: 패키지 스캐폴드

## 목적 ^purpose

v0.1의 taxonomy-engine 패키지 스캐폴드 작업 원문을 보존한다.

## Task 0: 패키지 스캐폴드

**Files:**
- Create: `packages/taxonomy-engine/package.json`
- Create: `packages/taxonomy-engine/tsup.config.ts`
- Create: `packages/taxonomy-engine/tsconfig.json`
- Create: `packages/taxonomy-engine/src/index.ts`
- Create: `packages/taxonomy-engine/vitest.config.ts`
- Create: `packages/taxonomy-engine/README.md`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "taxonomy-engine",
  "version": "0.1.0",
  "description": "YAML 텍소노미 선언·검증·인덱싱·코드 생성 라이브러리",
  "license": "MIT",
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
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsup": "^8.5.1",
    "typescript": "^5.8.2",
    "vitest": "^1.6.1"
  }
}
```

- [ ] **Step 2: tsup.config.ts**

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
});
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    globals: true,
  },
});
```

- [ ] **Step 5: src/index.ts (empty)**

```typescript
// public exports — populated by later tasks
export {};
```

- [ ] **Step 6: README.md**

```markdown
# taxonomy-engine

YAML 텍소노미 선언·검증·인덱싱·코드 생성 라이브러리.

설계: `../../docs/proposals/taxonomy-engine/00-design.md`
```

- [ ] **Step 7: 빌드 통과 확인**

Run:
```bash
pnpm --filter taxonomy-engine install
pnpm --filter taxonomy-engine build
```
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` 생성

- [ ] **Step 8: 커밋**

```bash
git add packages/taxonomy-engine
git commit -m "feat(taxonomy-engine): scaffold package (Task 0)"
```

---
