import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**"],
    passWithNoTests: true,
  },
  esbuild: {
    // NestJS @Injectable() 등 레거시 데코레이터 호환 — Plan 15c interceptor 의존.
    target: "es2022",
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
      },
    },
  },
});
