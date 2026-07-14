import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Feedback = {
  id: string;
  ref: string;
  tag: string;
  status: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  history: Array<{ at: string; from: string; to: string; note?: string }>;
};

export function readFeedbacks(jsonlPath: string): Feedback[] {
  if (!existsSync(jsonlPath)) return [];
  return readFileSync(jsonlPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Feedback);
}

export function appendFeedback(jsonlPath: string, feedback: Feedback): void {
  appendFileSync(jsonlPath, JSON.stringify(feedback) + '\n');
}

export function patchFeedback(
  jsonlPath: string,
  id: string,
  patch: Partial<Feedback>,
): Feedback | undefined {
  const all = readFeedbacks(jsonlPath);
  let updated: Feedback | undefined;
  const newLines = all.map((f) => {
    if (f.id !== id) return JSON.stringify(f);
    // history는 append 모드
    const newHistory = patch.history ? [...f.history, ...patch.history] : f.history;
    updated = { ...f, ...patch, history: newHistory, updatedAt: new Date().toISOString() };
    return JSON.stringify(updated);
  });
  if (updated) {
    writeFileSync(jsonlPath, newLines.join('\n') + '\n');
  }
  return updated;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function feedbackApiPlugin(jsonlPath: string): Plugin {
  return {
    name: 'taxonomy-web:feedback-api',
    configureServer(server) {
      server.middlewares.use(
        '/api/feedbacks',
        async (req: IncomingMessage, res: ServerResponse, next) => {
          try {
            if (req.method === 'GET') {
              const feedbacks = readFeedbacks(jsonlPath);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(feedbacks));
              return;
            }
            if (req.method === 'POST') {
              const body = await readBody(req);
              const feedback = JSON.parse(body) as Feedback;
              appendFeedback(jsonlPath, feedback);
              res.statusCode = 201;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(feedback));
              return;
            }
            if (req.method === 'PATCH') {
              const body = await readBody(req);
              const { id, ...patch } = JSON.parse(body);
              const updated = patchFeedback(jsonlPath, id as string, patch as Partial<Feedback>);
              if (!updated) {
                res.statusCode = 404;
                res.end();
                return;
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(updated));
              return;
            }
            next();
          } catch (e) {
            res.statusCode = 500;
            res.end(String((e as Error).message));
          }
        },
      );
    },
  };
}
