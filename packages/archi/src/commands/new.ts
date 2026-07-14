import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TEMPLATE_REGISTRY } from '../templates/registry.js';
import { generateMetadata, getTodayString } from '../engine/naming.js';

interface NewOptions {
  interactive?: boolean;
  title?: string;
  scope?: string;
  tags?: string;
  refs?: string;
}

export async function createDocument(type: string, targetDir: string, options: NewOptions) {
  const archRoot = resolve(targetDir, 'architecture');

  if (!existsSync(archRoot)) {
    console.error(
      chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`),
    );
    process.exit(1);
  }

  const normalizedType = type.toLowerCase();
  const template = TEMPLATE_REGISTRY[normalizedType];

  if (!template) {
    console.error(chalk.red(`❌ 지원하지 않는 문서 타입입니다: ${type}`));
    console.log(chalk.yellow(`가능한 타입: roadmap, prd, progress, session, handoff`));
    process.exit(1);
  }

  let title = options.title || '';
  let scope = options.scope;
  let tagsStr = options.tags || '';
  let refsStr = options.refs || '';

  // 1. Interactive 모드 활성화 (필수 필드가 없거나 -i 가 활성화된 경우)
  if (options.interactive || !title || (normalizedType === 'prd' && !scope)) {
    console.log(chalk.cyan(`📝 ${template.name} 생성을 위한 메타데이터 입력:`));

    const questions: any[] = [];

    if (!title) {
      questions.push({
        type: 'input',
        name: 'title',
        message: '문서 제목(Title)을 입력하세요:',
        default: `New ${template.name}`,
        validate: (input: string) => input.trim().length > 0 || '제목은 필수입니다.',
      });
    }

    if (normalizedType === 'prd' && !scope) {
      // archi-adr.yaml에서 존재하는 scope 목록을 파싱하여 선택지로 보여준다.
      let scopeChoices = [
        'SCOPE-DSL',
        'SCOPE-VALIDATOR',
        'SCOPE-RENDERER',
        'SCOPE-METADATA',
        'SCOPE-GOVERNANCE',
      ];
      const modelPath = join(archRoot, 'model', 'archi-adr.yaml');
      if (existsSync(modelPath)) {
        try {
          const content = readFileSync(modelPath, 'utf-8');
          const scopeMatches = [...content.matchAll(/^\s{2}- id:\s+(SCOPE-\S+)/gm)];
          if (scopeMatches.length > 0) {
            scopeChoices = scopeMatches.map((m) => m[1]);
          }
        } catch {
          // ignore
        }
      }

      questions.push({
        type: 'list',
        name: 'scope',
        message: '연관 Scope Unit을 선택하세요:',
        choices: scopeChoices,
      });
    }

    if (!options.tags) {
      questions.push({
        type: 'input',
        name: 'tags',
        message: '분류 태그를 입력하세요 (콤마 구분):',
        default: normalizedType,
      });
    }

    if (!options.refs) {
      questions.push({
        type: 'input',
        name: 'refs',
        message: '참조할 문서 ID 목록을 입력하세요 (콤마 구분):',
        default: '',
      });
    }

    const answers = await inquirer.prompt(questions);
    if (answers.title) title = answers.title;
    if (answers.scope) scope = answers.scope;
    if (answers.tags !== undefined) tagsStr = answers.tags;
    if (answers.refs !== undefined) refsStr = answers.refs;
  }

  // 2. 메타데이터 최종 취합
  const tags = tagsStr
    ? tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [normalizedType];
  const refs = refsStr
    ? refsStr
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
    : [];
  const today = getTodayString();

  // 3. ID 및 파일 명명 엔진 가동
  const meta = generateMetadata(normalizedType, archRoot, {
    title,
    scope,
    date: today,
  });

  const finalMeta = {
    id: meta.id,
    title: meta.title,
    date: meta.date,
    scope: meta.scope,
    tags,
    refs,
  };

  // 4. 내용 작성
  const frontmatter = template.generateFrontmatter(finalMeta);
  const body = template.generateBody(finalMeta);
  const fileContent = `${frontmatter}\n\n${body}`;

  // 부모 디렉토리 생성 보장
  const fileDir = dirname(meta.fullPath);
  if (!existsSync(fileDir)) {
    mkdirSync(fileDir, { recursive: true });
  }

  // 5. 파일 저장 (과거 불변 스냅샷 저장)
  writeFileSync(meta.fullPath, fileContent, 'utf-8');
  console.log(chalk.green(`\n✔ 새 거버넌스 문서 생성 완료!`));
  console.log(chalk.dim(`ID:       ${meta.id}`));
  console.log(chalk.dim(`파일명:   ${meta.filename}`));
  console.log(chalk.dim(`경로:     ${relative(archRoot, meta.fullPath)}`));

  // 6. current.md 동기화 (HEAD pointer 갱신)
  const currentPath = join(
    archRoot,
    'docs',
    'governance',
    normalizedType === 'session' ? 'sessions' : normalizedType,
    'current.md',
  );
  // session은 sessions 디렉토리 아래에 current.md를 둔다.
  const currentDir = dirname(currentPath);
  if (existsSync(currentDir)) {
    writeFileSync(currentPath, fileContent, 'utf-8');
    console.log(chalk.green(`✔ ${normalizedType}/current.md HEAD 포인터 최신화 완료!`));
  }

  // 7. 세션 문서일 경우 timeline.md에 자동 추가 연동
  if (normalizedType === 'session') {
    const timelinePath = join(archRoot, 'docs', 'governance', 'timeline.md');
    if (existsSync(timelinePath)) {
      try {
        let timelineContent = readFileSync(timelinePath, 'utf-8');
        const entry = `\n## ${today}\n* [${meta.id}] ${title}\n`;

        // 오늘 날짜 헤더가 이미 존재하는지 검사
        if (timelineContent.includes(`## ${today}`)) {
          // 해당 섹션 아래에 리스트 추가
          const target = `## ${today}`;
          timelineContent = timelineContent.replace(target, `${target}\n* [${meta.id}] ${title}`);
        } else {
          // 맨 아래 또는 Timeline Events 아래에 추가
          if (timelineContent.includes('## Timeline Events')) {
            timelineContent = timelineContent.replace(
              '## Timeline Events',
              `## Timeline Events\n${entry}`,
            );
          } else {
            timelineContent += `\n${entry}`;
          }
        }
        writeFileSync(timelinePath, timelineContent, 'utf-8');
        console.log(chalk.green(`✔ timeline.md에 세션 이력 등록 완료!`));
      } catch (err) {
        console.error(chalk.yellow(`⚠ timeline.md 갱신 중 에러 발생:`, err));
      }
    }
  }
}
