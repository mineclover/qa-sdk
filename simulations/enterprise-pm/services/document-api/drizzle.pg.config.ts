import type { Config } from 'drizzle-kit';

export default {
  schema: './src/document/pg/schema.ts',
  out: './drizzle/pg',
  dialect: 'postgresql',
} satisfies Config;
