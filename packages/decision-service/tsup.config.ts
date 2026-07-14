import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'es2023',
  platform: 'node',
  splitting: false,
  clean: true,
  external: [
    // npm 패키지
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-fastify',
    'better-sqlite3',
    'dotenv',
    'drizzle-orm',
    'reflect-metadata',
    'rxjs',
    'zod',
    // workspace 패키지
    '@qa-sdk/core',
    '@qa-sdk/logger',
    'decision-flow',
  ],
  // drizzle 마이그레이션 복사
  onSuccess: 'cp -r drizzle dist/ 2>/dev/null || true',
});
