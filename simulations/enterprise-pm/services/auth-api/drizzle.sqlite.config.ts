import type { Config } from "drizzle-kit";

export default {
  schema: "./src/auth/sqlite/schema.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  driver: "better-sqlite",
} satisfies Config;
