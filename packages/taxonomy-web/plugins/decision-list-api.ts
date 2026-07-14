import type { Plugin } from 'vite';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDecisionFile } from 'taxonomy-decision-bridge';

const DECISIONS_DIR = 'docs/decisions';

export type DecisionListItem = {
  id: string;
  fileName: string;
  lifecycle: string;
  subject: string;
  updated: string;
  mtime: number;
};

export function listDecisions(repoRoot: string): DecisionListItem[] {
  const dir = resolve(repoRoot, DECISIONS_DIR);
  if (!existsSync(dir)) return [];
  const items: DecisionListItem[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = resolve(dir, name);
    try {
      const text = readFileSync(full, 'utf8');
      const file = parseDecisionFile(text);
      items.push({
        id: file.meta.id,
        fileName: name,
        lifecycle: file.meta.lifecycle,
        subject: file.meta.subject,
        updated: file.meta.updated,
        mtime: statSync(full).mtimeMs,
      });
    } catch {
      // parse 실패 파일은 skip (frontmatter 누락 등)
    }
  }
  return items.sort((a, b) => b.mtime - a.mtime);
}

export function loadDecisionByFileName(
  repoRoot: string,
  fileName: string,
): { text: string } | null {
  // 디렉토리 traversal 방지: fileName은 단순 .md 이름만 허용
  if (!/^[a-zA-Z0-9_-]+\.md$/.test(fileName)) return null;
  const full = resolve(repoRoot, DECISIONS_DIR, fileName);
  if (!existsSync(full)) return null;
  return { text: readFileSync(full, 'utf8') };
}

export function decisionListApiPlugin(repoRoot: string): Plugin {
  return {
    name: 'taxonomy-web:decision-list-api',
    configureServer(server) {
      server.middlewares.use('/api/decision-list', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        const items = listDecisions(repoRoot);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ items }));
      });
      server.middlewares.use('/api/decision-file', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const fileName = url.searchParams.get('fileName');
        if (!fileName) {
          res.statusCode = 400;
          res.end('fileName 쿼리 파라미터 필수');
          return;
        }
        const loaded = loadDecisionByFileName(repoRoot, fileName);
        if (!loaded) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.end(loaded.text);
      });
    },
  };
}
