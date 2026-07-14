import type { Plugin } from 'vite';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

type RelatedDoc = {
  path: string;
  lineNumber: number;
  snippet: string;
};

const SEARCH_PATHS_DEFAULT = ['docs/proposals/taxonomy-engine', 'docs/proposals/taxonomy-web'];

export function searchRelatedDocs(opts: {
  repoRoot: string;
  term: string;
  searchPaths?: string[];
  maxResults?: number;
}): RelatedDoc[] {
  const paths = opts.searchPaths ?? SEARCH_PATHS_DEFAULT;
  const max = opts.maxResults ?? 30;
  const matches: RelatedDoc[] = [];
  const term = opts.term;
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`);

  for (const dir of paths) {
    const abs = join(opts.repoRoot, dir);
    if (!existsSync(abs)) continue;
    walkMd(abs, opts.repoRoot, regex, matches, max);
    if (matches.length >= max) break;
  }
  return matches.slice(0, max);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walkMd(
  dir: string,
  repoRoot: string,
  regex: RegExp,
  out: RelatedDoc[],
  max: number,
): void {
  if (out.length >= max) return;
  const entries = readdirSync(dir);
  for (const name of entries) {
    if (out.length >= max) break;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      walkMd(p, repoRoot, regex, out, max);
    } else if (s.isFile() && /\.(md|mdx)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          out.push({
            path: relative(repoRoot, p),
            lineNumber: i + 1,
            snippet: lines[i].trim().slice(0, 200),
          });
          if (out.length >= max) return;
        }
      }
    }
  }
}

export function relatedDocsApiPlugin(repoRoot: string): Plugin {
  return {
    name: 'taxonomy-web:related-docs-api',
    configureServer(server) {
      server.middlewares.use('/api/related-docs', (req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const term = url.searchParams.get('term');
        if (!term) {
          res.statusCode = 400;
          res.end('term query required');
          return;
        }
        const matches = searchRelatedDocs({ repoRoot, term });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(matches));
      });
    },
  };
}
