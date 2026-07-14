import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import chalk from 'chalk';
import { parseFrontmatter, parseModel } from '../engine/validator.js';
import { validateArchitecture } from '../engine/validator.js';

function getFilesRecursively(dir: string, ext = '.md'): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    const list = readdirSync(d);
    for (const entry of list) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && entry.endsWith(ext) && entry !== '.gitkeep') {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

export function showStatus(targetDir: string) {
  const archRoot = resolve(targetDir, 'architecture');
  const govRoot = join(archRoot, 'docs', 'governance');
  const modelPath = join(archRoot, 'model', 'archi-adr.yaml');

  if (!existsSync(archRoot)) {
    console.error(
      chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`),
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`\n📊 아키텍처 운영 체제 현황 분석 중...\n`));

  // 1. 거버넌스 문서 로드 및 수명 주기 분석
  const govFiles = getFilesRecursively(govRoot, '.md');
  const docTypeCounts: Record<string, number> = {};
  const lifecycleCounts: Record<string, number> = {
    draft: 0,
    active: 0,
    resolved: 0,
    deprecated: 0,
    archived: 0,
  };

  let totalGovDocs = 0;

  for (const file of govFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const fm = parseFrontmatter(content);
      if (fm) {
        totalGovDocs++;

        // 타입 집계
        const type = fm.type || 'Unknown';
        docTypeCounts[type] = (docTypeCounts[type] || 0) + 1;

        // 수명 주기 집계
        const state = fm.lifecycle?.state;
        if (state && state in lifecycleCounts) {
          lifecycleCounts[state]++;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. 아키텍처 DSL 모델 분석
  const modelContent = existsSync(modelPath) ? readFileSync(modelPath, 'utf-8') : '';
  const model = parseModel(modelContent);

  // 3. 검증 결과 가동
  const { summary } = validateArchitecture(archRoot);

  // 4. 리포팅 렌더링
  console.log(chalk.bold.underline(`1. 거버넌스 문서 통계 (총 ${totalGovDocs}개)`));
  console.log(`  ${chalk.bold('문서 타입 분포:')}`);
  for (const [type, count] of Object.entries(docTypeCounts)) {
    console.log(`    • ${chalk.dim(type.padEnd(25))} : ${chalk.cyan(count)}개`);
  }

  console.log(`\n  ${chalk.bold('수명 주기(Lifecycle) 분포:')}`);
  console.log(
    `    • ${chalk.yellow('Draft (작성 중)')}     : ${chalk.cyan(lifecycleCounts.draft)}개`,
  );
  console.log(
    `    • ${chalk.green('Active (현재 유효)')}  : ${chalk.cyan(lifecycleCounts.active)}개`,
  );
  console.log(
    `    • ${chalk.blue('Resolved (완료됨)')}   : ${chalk.cyan(lifecycleCounts.resolved)}개`,
  );
  console.log(
    `    • ${chalk.dim('Deprecated (비권장)')} : ${chalk.cyan(lifecycleCounts.deprecated)}개`,
  );
  console.log(
    `    • ${chalk.red('Archived (보관됨)')}  : ${chalk.cyan(lifecycleCounts.archived)}개`,
  );

  console.log(chalk.bold(`\n${'─'.repeat(50)}`));
  console.log(chalk.bold.underline(`2. 아키텍처 스펙 모델 (archi-adr.yaml)`));
  console.log(
    `  • ${chalk.dim('Scope Units (분류 영역)')}  : ${chalk.green(model.scopes.length)}개`,
  );
  console.log(
    `  • ${chalk.dim('Elements (시스템 핵심 요소)')}  : ${chalk.green(model.elements.length)}개`,
  );
  console.log(
    `  • ${chalk.dim('Relations (요소 간 상호 관계)')} : ${chalk.green(model.relations.length)}개`,
  );
  console.log(
    `  • ${chalk.dim('Views (시각적 아키텍처 뷰)')}   : ${chalk.green(model.views.length)}개`,
  );

  console.log(chalk.bold(`\n${'─'.repeat(50)}`));
  console.log(chalk.bold.underline(`3. 거버넌스 검증 상태 (Validation Health)`));

  const totalRules = summary.total;
  const passedRules = summary.pass;
  const passRate = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 0;

  console.log(`  • ${chalk.dim('총 검증 수행 수')} : ${totalRules}회`);
  console.log(`  • ${chalk.dim('정상 통과 항목')} : ${chalk.green(passedRules)}회`);
  console.log(
    `  • ${chalk.dim('위반 에러 항목')} : ${summary.fail > 0 ? chalk.red(summary.fail) : chalk.green(0)}개`,
  );
  console.log(
    `  • ${chalk.dim('주의 경고 항목')} : ${summary.warn > 0 ? chalk.yellow(summary.warn) : chalk.green(0)}개`,
  );

  let rateColor = chalk.green;
  if (passRate < 70) rateColor = chalk.red;
  else if (passRate < 100) rateColor = chalk.yellow;

  console.log(`  • ${chalk.dim('검증 통과율  ')} : ${rateColor(`${passRate}%`)}`);

  console.log();
}
