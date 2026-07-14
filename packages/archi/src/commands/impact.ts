import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';

interface ManifestEntry {
  id: string;
  name: string;
  tier: string;
  boundary: string;
  internalDeps: string[];
}

export function analyzeImpact(targetDir: string, packageId: string) {
  const manifestPath = resolve(targetDir, 'docs', 'generated-api-manifest.json');

  if (!existsSync(manifestPath)) {
    console.error(
      chalk.red(
        `❌ API 매니페스트를 찾을 수 없습니다. 'npx tsx scripts/generate-api-reference.ts'를 먼저 실행해 주세요.`,
      ),
    );
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const allPackages: ManifestEntry[] = Object.values(manifest.layers).flat() as ManifestEntry[];

  const target = allPackages.find((p) => p.id === packageId || p.name === packageId);

  if (!target) {
    console.error(chalk.red(`❌ 패키지 '${packageId}'를 매니페스트에서 찾을 수 없습니다.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n⚡ 아키텍처 영향도 분석 (Impact Analysis): '${target.id}'`));
  console.log(`${chalk.bold('계층(Tier):')} ${chalk.magenta(target.tier)}`);
  console.log(`${chalk.bold('경계(Boundary):')} ${chalk.blue(target.boundary)}`);

  // 1. Upstream Dependencies (내가 의존하는 것들)
  console.log(chalk.bold(`\n[1] Upstream Dependencies (내가 소비하는 모듈)`));
  if (target.internalDeps.length > 0) {
    target.internalDeps.forEach((depId) => {
      const dep = allPackages.find((p) => p.id === depId);
      const tierLabel = dep ? ` (${dep.tier})` : '';
      console.log(`  ⬅️  ${chalk.yellow(depId)}${chalk.dim(tierLabel)}`);
    });
  } else {
    console.log(chalk.dim('  (내부 의존성 없음)'));
  }

  // 2. Downstream Dependents (나를 의존하는 것들 - 영향 범위)
  console.log(chalk.bold(`\n[2] Downstream Dependents (변경 시 영향 받는 모듈)`));
  const dependents = allPackages.filter((p) => p.internalDeps.includes(target.id));

  if (dependents.length > 0) {
    dependents.forEach((dep) => {
      console.log(`  ➡️  ${chalk.red(dep.id)} ${chalk.dim(`(${dep.tier})`)}`);
    });
    console.log(chalk.bold(`\nTotal Impact Radius: ${chalk.red(dependents.length)} packages.`));
  } else {
    console.log(chalk.dim('  (이 패키지에 의존하는 내부 모듈 없음)'));
  }

  console.log();
}
