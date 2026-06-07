import { execSync } from "node:child_process";
import chalk from "chalk";

/**
 * AI Feedback Loop — 
 * 에이전트가 코드를 변경한 후 이 스크립트를 실행하여 아키텍처 정합성과 API 영향도를 즉시 확인한다.
 */

async function main() {
  console.log(chalk.bold.cyan("\n🤖 AI Development Feedback Loop starting..."));

  // 1. Lint Check
  console.log(chalk.dim("\n[1/3] Checking syntax & lint..."));
  try {
    execSync("pnpm run lint", { stdio: "inherit" });
    console.log(chalk.green("✨ Lint passed."));
  } catch {
    console.error(chalk.red("❌ Lint failed. Fix syntax errors first."));
  }

  // 2. Architectural Boundaries
  console.log(chalk.dim("\n[2/3] Verifying architectural tiers..."));
  try {
    execSync("npx tsx scripts/check-dependency-boundaries.ts", { stdio: "inherit" });
    console.log(chalk.green("✨ Tier boundaries intact."));
  } catch {
    console.warn(chalk.yellow("⚠️ Architectural violations detected. Review the report."));
  }

  // 3. API Impact Analysis
  console.log(chalk.dim("\n[3/3] Analyzing API Impact Radius..."));
  try {
    execSync("npx tsx scripts/api-impact-analyzer.ts", { stdio: "inherit" });
  } catch (err) {
    console.error(chalk.red("❌ Impact analysis failed."));
  }

  console.log(chalk.bold.cyan("\n🚀 Feedback Loop Complete. Proceed with caution.\n"));
}

main().catch(console.error);
