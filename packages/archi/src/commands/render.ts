import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import chalk from 'chalk';
import yaml from 'js-yaml';

export function renderMermaidViews(targetDir: string) {
  const archRoot = resolve(targetDir, 'architecture');
  const modelPath = join(archRoot, 'model', 'archi-adr.yaml');
  const mermaidOutputDir = join(archRoot, 'generated', 'mermaid');

  if (!existsSync(archRoot)) {
    console.error(
      chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`),
    );
    process.exit(1);
  }

  if (!existsSync(modelPath)) {
    console.error(chalk.red(`❌ 아키텍처 모델 파일('model/archi-adr.yaml')이 존재하지 않습니다.`));
    process.exit(1);
  }

  console.log(chalk.cyan(`🔄 model/archi-adr.yaml 명세 분석 및 Mermaid 뷰 추출 시작...\n`));

  // 1. 모델 파일 로드 및 파싱
  let modelYaml = '';
  try {
    modelYaml = readFileSync(modelPath, 'utf-8');
  } catch (err) {
    console.error(chalk.red(`❌ 모델 파일을 읽는 중 오류가 발생했습니다:`), err);
    process.exit(1);
  }

  let rawParsed: any;
  try {
    rawParsed = yaml.load(modelYaml);
  } catch (err) {
    console.error(chalk.red(`❌ 모델 YAML 분석 실패:`), err);
    process.exit(1);
  }

  const views = rawParsed?.views || [];

  if (!Array.isArray(views) || views.length === 0) {
    console.log(chalk.yellow(`⚠ 모델에 선언된 아키텍처 뷰(Views)가 없습니다.`));
    process.exit(0);
  }

  // 2. 출력 디렉토리 보장
  if (!existsSync(mermaidOutputDir)) {
    mkdirSync(mermaidOutputDir, { recursive: true });
  }

  let count = 0;

  // 3. 각 뷰의 mermaid 코드를 개별 .mmd 파일로 저장
  for (const view of views) {
    if (!view.id) continue;

    const mermaidCode = view.mermaid;
    if (!mermaidCode) {
      console.log(
        chalk.yellow(
          `⚠ View '${view.id}': mermaid 다이어그램 코드가 정의되어 있지 않아 건너뜁니다.`,
        ),
      );
      continue;
    }

    const outputFilePath = join(mermaidOutputDir, `${view.id}.mmd`);

    try {
      writeFileSync(outputFilePath, mermaidCode.trim() + '\n', 'utf-8');
      console.log(
        `${chalk.green('✓')} View ${chalk.bold(view.id)} (${view.name || '무제 뷰'}) ` +
          `-> ${chalk.dim(relative(archRoot, outputFilePath))} 추출 완료`,
      );
      count++;
    } catch (err) {
      console.error(chalk.red(`✗ View '${view.id}' 다이어그램 추출 실패:`), err);
    }
  }

  console.log(chalk.green(`\n✔ Mermaid 다이어그램 추출 완료! (총 ${count}개 뷰 저장됨)`));
  console.log(chalk.dim(`출력 경로: ${relative(archRoot, mermaidOutputDir)}`));
}
