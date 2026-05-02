import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["source"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["dist/**"],
    passWithNoTests: true,
    // Plan 07b/07c/07d PG 테스트가 동일 ingest schema 테이블을 공유하므로
    // 파일 단위 병렬 실행 비활성화. drizzle pgSchema("ingest")가 schema 이름을
    // 하드코딩하므로 random schema 격리가 불가능.
    // D1/메모리 테스트는 영향 경미 (<5s).
    fileParallelism: false,
  },
});
