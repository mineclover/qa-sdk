import type { Plugin } from 'vite';
import { execSync } from 'node:child_process';

type GitCommit = {
  sha: string;
  author: string;
  date: string;
  subject: string;
};

export function fetchGitLog(opts: {
  cwd: string;
  file: string;
  limit?: number;
  searchTerm?: string;
}): GitCommit[] {
  const limit = opts.limit ?? 50;
  const args = ['log', `--max-count=${limit}`, '--pretty=format:%H|%an|%ai|%s'];
  if (opts.searchTerm) {
    args.push(`-S${opts.searchTerm}`);
  }
  args.push('--', opts.file);
  try {
    const out = execSync(`git ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, {
      cwd: opts.cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!out) return [];
    return out.split('\n').map((line) => {
      const [sha, author, date, ...rest] = line.split('|');
      const subject = rest.join('|'); // subject에 | 포함될 수 있음
      return { sha, author, date, subject };
    });
  } catch {
    return [];
  }
}

export function gitLogApiPlugin(repoRoot: string): Plugin {
  return {
    name: 'taxonomy-web:git-log-api',
    configureServer(server) {
      server.middlewares.use('/api/git-log', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const file = url.searchParams.get('file');
        const ref = url.searchParams.get('ref');
        if (!file) {
          res.statusCode = 400;
          res.end('file query required');
          return;
        }
        // ref에서 entry id 추출 (형식: "tax:axis.entry")
        let searchTerm: string | undefined;
        if (ref) {
          const m = ref.match(/[:.]([a-zA-Z][\w-]*)$/);
          if (m) searchTerm = m[1];
        }
        const log = fetchGitLog({ cwd: repoRoot, file, searchTerm });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(log));
      });
    },
  };
}
