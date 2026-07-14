import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**'],
    passWithNoTests: true,
    // PG 테스트가 동일 audit.audit_entries 테이블을 공유하므로
    // 파일 단위 병렬 실행 비활성화. drizzle pgSchema("audit")가 schema 이름을
    // 하드코딩하므로 random schema 격리가 불가능.
    fileParallelism: false,
  },
});
