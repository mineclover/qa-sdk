import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import chalk from 'chalk';
import { parseFrontmatter } from '../engine/validator.js';

// 재귀 파일 스캔
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

export function buildTimeline(targetDir: string) {
  const archRoot = resolve(targetDir, 'architecture');
  const govRoot = join(archRoot, 'docs', 'governance');
  const sessionsDir = join(govRoot, 'sessions');
  const timelinePath = join(govRoot, 'timeline.md');

  if (!existsSync(archRoot)) {
    console.error(
      chalk.red(`❌ 'architecture/' 폴더를 찾을 수 없습니다. 먼저 'archi init'를 실행해 주세요.`),
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`🔄 모든 세션 문서를 스캔하여 timeline.md 재생성 중...`));

  if (!existsSync(sessionsDir)) {
    console.log(chalk.yellow(`⚠ 세션 문서 디렉토리('sessions/')가 비어있습니다.`));
  }

  // 1. 모든 세션 파일 스캔
  const sessionFiles = getFilesRecursively(sessionsDir, '.md').filter((f) => {
    // current.md는 스냅샷이 아니므로 제외
    return !f.endsWith('current.md');
  });

  interface SessionEntry {
    id: string;
    title: string;
    date: string;
    seq: string;
    relativePath: string;
  }

  const entries: SessionEntry[] = [];

  for (const file of sessionFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const fm = parseFrontmatter(content);

      if (fm?.type === 'SessionHistoryDocument') {
        const id = fm.id || 'GOV-SESSION-UNKNOWN';
        const title = fm.title || 'Untitled Session';
        const date = fm.date || '1970-01-01';

        // ID 포맷 GOV-SESSION-YYYYMMDD-NNN 에서 시퀀스 추출 시도
        const match = id.match(/GOV-SESSION-\d{8}-(\d{3})$/);
        const seq = match ? match[1] : '000';

        entries.push({
          id,
          title,
          date,
          seq,
          relativePath: relative(govRoot, file),
        });
      }
    } catch (err) {
      console.warn(chalk.yellow(`⚠ 파일 해석 실패 [Skip]: ${relative(archRoot, file)} -`, err));
    }
  }

  // 2. 시간순 및 시퀀스순 정렬 (오름차순)
  entries.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.seq.localeCompare(b.seq);
  });

  // 3. timeline.md 내용 빌드
  let markdown = `---
id: GOV-TIMELINE
type: TimelineDocument
title: "Architecture Governance Timeline"
date: ${new Date().toISOString().split('T')[0]}
lifecycle:
  state: active
  created_at: 2026-05-26
  updated_at: ${new Date().toISOString().split('T')[0]}
tags: ["timeline", "governance"]
---

# Architecture Governance Timeline

## 목적 ^purpose
아키텍처 설계와 관련된 모든 세션의 기록을 시간순으로 나열하여, 아키텍처가 언제 어떤 흐름으로 발전해 왔는지 역사적 흐름을 보장합니다.

## Timeline Events
`;

  // 날짜별로 그룹화하여 렌더링
  let currentDate = '';
  for (const entry of entries) {
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      markdown += `\n## ${currentDate}\n`;
    }
    // 상대 경로 링크를 달아주어 편리한 탐색 제공
    markdown += `* [${entry.id}](${entry.relativePath}) - ${entry.title}\n`;
  }

  if (entries.length === 0) {
    markdown += `\n*등록된 세션 이력이 없습니다.*\n`;
  }

  // 4. 저장
  writeFileSync(timelinePath, markdown, 'utf-8');
  console.log(
    chalk.green(`✔ timeline.md가 성공적으로 갱신되었습니다! (스캔 세션수: ${entries.length}개)`),
  );
  console.log(chalk.dim(`저장 경로: ${relative(archRoot, timelinePath)}`));
}
