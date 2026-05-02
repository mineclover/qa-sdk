import type { Config } from "drizzle-kit";

export default {
  schema: "./src/approval/pg/schema.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
} satisfies Config;
