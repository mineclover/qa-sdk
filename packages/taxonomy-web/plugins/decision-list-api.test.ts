import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listDecisions, loadDecisionByFileName } from './decision-list-api';

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'tax-web-list-'));
  mkdirSync(join(root, 'docs/decisions'), { recursive: true });
  return root;
}

describe('listDecisions', () => {
  it('docs/decisions/ 없으면 빈 배열', () => {
    const root = mkdtempSync(join(tmpdir(), 'tax-web-list-empty-'));
    expect(listDecisions(root)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('정상 frontmatter .md를 mtime 내림차순으로 반환', () => {
    const root = setupRepo();
    const make = (name: string, id: string, lifecycle: string) => {
      writeFileSync(
        join(root, 'docs/decisions', name),
        `---\nid: ${id}\nsubject: subj-${id}\nlifecycle: ${lifecycle}\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-05-01T00:00:00Z\n---\nbody\n`,
      );
    };
    make('a.md', 'a', 'draft');
    make('b.md', 'b', 'review');
    const items = listDecisions(root);
    expect(items.length).toBe(2);
    expect(items.map((i) => i.id).sort()).toEqual(['a', 'b']);
    rmSync(root, { recursive: true, force: true });
  });

  it('parse 실패 파일은 skip', () => {
    const root = setupRepo();
    writeFileSync(join(root, 'docs/decisions/bad.md'), 'no frontmatter');
    writeFileSync(
      join(root, 'docs/decisions/good.md'),
      `---\nid: good\nsubject: g\nlifecycle: draft\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\n---\nbody\n`,
    );
    const items = listDecisions(root);
    expect(items.map((i) => i.id)).toEqual(['good']);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('loadDecisionByFileName', () => {
  it('정상 파일 로드', () => {
    const root = setupRepo();
    writeFileSync(
      join(root, 'docs/decisions/x.md'),
      `---\nid: x\nsubject: s\nlifecycle: draft\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\n---\nhello\n`,
    );
    const loaded = loadDecisionByFileName(root, 'x.md');
    expect(loaded?.text).toContain('hello');
    rmSync(root, { recursive: true, force: true });
  });

  it('디렉토리 traversal 차단 — ../* 패턴은 null', () => {
    const root = setupRepo();
    expect(loadDecisionByFileName(root, '../etc/passwd')).toBeNull();
    expect(loadDecisionByFileName(root, 'a/b.md')).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });

  it('없는 파일은 null', () => {
    const root = setupRepo();
    expect(loadDecisionByFileName(root, 'missing.md')).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });
});
