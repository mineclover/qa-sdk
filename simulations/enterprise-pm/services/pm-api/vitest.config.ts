import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**"],
    passWithNoTests: true,
    // PG 테스트가 sim.pm_* 테이블을 공유하므로 파일 단위 병렬 실행 비활성화.
    fileParallelism: false,
  },
});
