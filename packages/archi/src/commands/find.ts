import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import chalk from 'chalk';
import { parseModel, findFilesRecursively, parseFrontmatter } from '../engine/validator.js';

export function findArchitecture(targetDir: string, pattern: string) {
  const archRoot = resolve(targetDir, 'architecture');
  const modelPath = join(archRoot, 'model', 'archi-adr.yaml');
  const govRoot = join(archRoot, 'docs', 'governance');

  if (!existsSync(archRoot)) {
    console.error(chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다.`));
    process.exit(1);
  }

  const regex = new RegExp(pattern, 'i');
  console.log(chalk.cyan(`\n🔍 아키텍처 검색: '${pattern}'`));

  // 1. 모델 스펙 검색
  if (existsSync(modelPath)) {
    console.log(chalk.bold(`\n[1] 모델 스펙 검색 결과 (archi-adr.yaml)`));
    try {
      const model = parseModel(readFileSync(modelPath, 'utf-8'));

      const matchedScopes = model.scopes.filter((s) => regex.test(s));
      const matchedElements = model.elements.filter((e) => regex.test(e));

      if (matchedScopes.length > 0) {
        matchedScopes.forEach((s) => console.log(`  📄 Scope: ${chalk.green(s)}`));
      }
      if (matchedElements.length > 0) {
        matchedElements.forEach((e) => console.log(`  🏷️  Element: ${chalk.yellow(e)}`));
      }

      if (matchedScopes.length === 0 && matchedElements.length === 0) {
        console.log(chalk.dim('  (매칭되는 모델 요소 없음)'));
      }
    } catch {
      /* ignore */
    }
  }

  // 2. 거버넌스 문서 검색
  console.log(chalk.bold(`\n[2] 거버넌스 문서 검색 결과`));
  const govFiles = findFilesRecursively(govRoot, '.md');
  let foundDocs = 0;

  for (const file of govFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const fm = parseFrontmatter(content);
      const title = fm?.title || '';
      const id = fm?.id || '';

      if (regex.test(id) || regex.test(title) || regex.test(content)) {
        const relPath = relative(archRoot, file);
        console.log(
          `  📄 ${chalk.bold(id || relPath)}: ${chalk.dim(title)} ${chalk.gray(`(${relPath})`)}`,
        );
        foundDocs++;
      }
    } catch {
      /* ignore */
    }
  }

  if (foundDocs === 0) {
    console.log(chalk.dim('  (매칭되는 문서 없음)'));
  }

  console.log();
}
