import type { Config } from "drizzle-kit";

export default {
  schema: "./src/auth/pg/schema.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
} satisfies Config;
