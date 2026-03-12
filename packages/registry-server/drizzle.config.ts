import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const readEnvVar = (fileName: string, key: string) => {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return undefined;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const currentKey = trimmedLine.slice(0, separatorIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const value = trimmedLine.slice(separatorIndex + 1).trim();
    return value.replace(/^(['"])(.*)\1$/, "$2");
  }

  return undefined;
};

const isGenerateCommand = process.argv.includes("generate");
const databaseUrl =
  process.env.DATABASE_URL ??
  readEnvVar(".env.local", "DATABASE_URL") ??
  readEnvVar(".env", "DATABASE_URL") ??
  (isGenerateCommand ? readEnvVar(".env.example", "DATABASE_URL") : undefined);

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it in the environment or add it to .env.",
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
