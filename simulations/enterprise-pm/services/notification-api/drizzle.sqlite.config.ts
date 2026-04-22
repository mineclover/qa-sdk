import type { Config } from "drizzle-kit";

export default {
  schema: "./src/notification/sqlite/schema.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  driver: "better-sqlite",
} satisfies Config;
