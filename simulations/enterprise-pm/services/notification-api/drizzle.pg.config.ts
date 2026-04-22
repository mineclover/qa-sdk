import type { Config } from "drizzle-kit";

export default {
  schema: "./src/notification/pg/schema.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
} satisfies Config;
