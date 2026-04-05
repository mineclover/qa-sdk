import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // gate-service 환경 의존 → mock으로 리다이렉트
      // 실제 사용 시 서비스별로 추가
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
