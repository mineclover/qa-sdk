import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ?? process.env.TRACE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or TRACE_DATABASE_URL is required for @qa-sdk/store.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
