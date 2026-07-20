// @def.doc definition-data-source

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { LocalDataSource } from './local-data-source.js';
import { syncDocsToLocalDb } from './sync-local-db.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qa-sdk-def-sync-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('syncDocsToLocalDb', () => {
  it('full body, raw declared links, version/revision을 최신 documents snapshot에 저장한다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    writeFileSync(
      join(docsDir, 'sample.md'),
      `---
def:
  id: sample-doc
  version: v2
  revision: 7
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [testing]
  links:
    - target: missing-doc
      type: depends_on
---
# Sample Doc

## 목적 ^purpose

본문 목적

## 구성 ^overview

본문 전체가 저장돼야 한다.
`,
      'utf8',
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.synced).toBe(1);

    const db = new Database(join(rootDir, 'data/definition-service.sqlite'), { readonly: true });
    try {
      const doc = db
        .prepare(`
          SELECT doc_id, doc_version, revision, body, links_json
          FROM documents
          WHERE doc_id = ?
        `)
        .get('sample-doc') as
        | {
            doc_id: string;
            doc_version: string | null;
            revision: number | null;
            body: string;
            links_json: string;
          }
        | undefined;

      expect(doc).toBeDefined();
      expect(doc?.doc_version).toBe('v2');
      expect(doc?.revision).toBe(7);
      expect(doc?.body).toContain('## 목적 ^purpose');
      expect(doc?.body).toContain('본문 전체가 저장돼야 한다.');
      expect(JSON.parse(doc?.links_json ?? '[]')).toEqual([
        { target: 'missing-doc', type: 'depends_on' },
      ]);

      const rawLink = db
        .prepare(`
          SELECT source_id, target_id, source_address, target_address, link_type
          FROM document_links
          WHERE source_id = ?
        `)
        .get('sample-doc') as
        | {
            source_id: string;
            target_id: string;
            source_address: string | null;
            target_address: string | null;
            link_type: string;
          }
        | undefined;

      expect(rawLink).toEqual({
        source_id: 'sample-doc',
        target_id: 'missing-doc',
        source_address: expect.stringMatching(/^def_document:v1:/),
        target_address: null,
        link_type: 'depends_on',
      });
    } finally {
      db.close();
    }
  });

  it('frontmatter의 v2 address를 documents.address에 보존한다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    writeFileSync(
      join(docsDir, 'addressed.md'),
      `---
def:
  id: addressed-doc
  address: def_document:v2:424242
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
---
# Addressed Doc

## 목적 ^purpose

v2 address 보존 확인
`,
      'utf8',
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.synced).toBe(1);

    const db = new Database(join(rootDir, 'data/definition-service.sqlite'), { readonly: true });
    try {
      const row = db
        .prepare('SELECT address FROM documents WHERE doc_id = ?')
        .get('addressed-doc') as { address: string | null } | undefined;
      expect(row?.address).toBe('def_document:v2:424242');
    } finally {
      db.close();
    }
  });

  it('링크 조회 시 source/target address를 병행 노출한다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    writeFileSync(
      join(docsDir, 'source.md'),
      `---
def:
  id: source-doc
  address: def_document:v2:101
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  links:
    - target: target-doc
      type: depends_on
---
# Source Doc

## 목적 ^purpose

source purpose
`,
      'utf8',
    );

    writeFileSync(
      join(docsDir, 'target.md'),
      `---
def:
  id: target-doc
  address: def_document:v2:202
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---
# Target Doc

## 목적 ^purpose

target purpose
`,
      'utf8',
    );

    await syncDocsToLocalDb({ rootDir });

    const db = new Database(join(rootDir, 'data/definition-service.sqlite'), { readonly: true });
    try {
      const rawLink = db
        .prepare(`
          SELECT source_id, target_id, source_address, target_address, link_type
          FROM document_links
          WHERE source_id = ? AND target_id = ?
        `)
        .get('source-doc', 'target-doc') as
        | {
            source_id: string;
            target_id: string;
            source_address: string | null;
            target_address: string | null;
            link_type: string;
          }
        | undefined;

      expect(rawLink).toEqual({
        source_id: 'source-doc',
        target_id: 'target-doc',
        source_address: 'def_document:v2:101',
        target_address: 'def_document:v2:202',
        link_type: 'depends_on',
      });
    } finally {
      db.close();
    }

    const source = new LocalDataSource(join(rootDir, 'data/definition-service.sqlite'), rootDir);
    try {
      await expect(source.getOutgoingLinks('source-doc')).resolves.toEqual([
        {
          target: 'target-doc',
          type: 'depends_on',
          sourceAddress: 'def_document:v2:101',
          targetAddress: 'def_document:v2:202',
        },
      ]);

      await expect(source.getIncomingLinks('target-doc')).resolves.toEqual([
        {
          source: 'source-doc',
          type: 'depends_on',
          sourceAddress: 'def_document:v2:101',
          targetAddress: 'def_document:v2:202',
        },
      ]);
    } finally {
      source.close();
    }
  });

  it('같은 파일이라도 symbol 단위로 authoritative boundary를 분리한다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    const pkgDir = join(rootDir, 'packages/demo/src');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(pkgDir, { recursive: true });

    writeFileSync(
      join(docsDir, 'event-prefix-group.md'),
      `---
def:
  id: event-prefix-group
  level: module
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
---

## 목적 ^purpose

이벤트 prefix 그룹.

## 구성 ^overview

이벤트 prefix를 묶는다.
`,
      'utf8',
    );

    writeFileSync(
      join(docsDir, 'observation-prefix-group.md'),
      `---
def:
  id: observation-prefix-group
  level: module
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
---

## 목적 ^purpose

관측 prefix 그룹.

## 구성 ^overview

관측 prefix를 묶는다.
`,
      'utf8',
    );

    writeFileSync(
      join(pkgDir, 'catalog.ts'),
      `// ${'@def'}.boundary event-prefix-group#Catalog.events.auth_event
// ${'@def'}.boundary observation-prefix-group#Catalog.observations.page_view
export const Catalog = {
  events: { auth_event: {} },
  observations: { page_view: {} },
};
`,
      'utf8',
    );
    writeFileSync(
      join(pkgDir, 'conflicting.ts'),
      `// ${'@def'}.boundary event-prefix-group
// ${'@def'}.boundary observation-prefix-group
export const conflicting = true;
`,
      'utf8',
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.codeReferences).toBe(4);

    const source = new LocalDataSource(join(rootDir, 'data/definition-service.sqlite'), rootDir);
    try {
      const ambiguous = await source.resolveByFile('packages/demo/src/catalog.ts');
      expect(ambiguous.kind).toBe('ambiguous');

      const validation = await source.validate();
      expect(
        validation.issues.filter((issue) => issue.type === 'ambiguous-code-boundary'),
      ).toHaveLength(1);

      const eventMapping = await source.resolveByFile(
        'packages/demo/src/catalog.ts:Catalog.events.auth_event',
      );
      expect(eventMapping.kind).toBe('unique');
      if (eventMapping.kind === 'unique') {
        expect(eventMapping.anchor.docId).toBe('event-prefix-group');
      }

      const observationMapping = await source.resolveByFile(
        'packages/demo/src/catalog.ts:Catalog.observations.page_view',
      );
      expect(observationMapping.kind).toBe('unique');
      if (observationMapping.kind === 'unique') {
        expect(observationMapping.anchor.docId).toBe('observation-prefix-group');
      }
    } finally {
      source.close();
    }
  });

  it('많은 frontmatter source refs를 SQLite 변수 한도 안에서 배치 적재한다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    const sources = Array.from(
      { length: 220 },
      (_, index) =>
        `    - packages/demo/src/generated-${String(index).padStart(3, '0')}.ts#Generated${index}`,
    ).join('\n');

    writeFileSync(
      join(docsDir, 'many-sources.md'),
      `---
def:
  id: many-sources-doc
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  sources:
${sources}
---
# Many Sources

## 목적 ^purpose

많은 source refs를 한 문서에 연결한다.
`,
      'utf8',
    );

    const result = await syncDocsToLocalDb({ rootDir });
    expect(result.codeReferences).toBe(220);

    const db = new Database(join(rootDir, 'data/definition-service.sqlite'), { readonly: true });
    try {
      const row = db
        .prepare('SELECT COUNT(*) AS count FROM code_references WHERE doc_id = ?')
        .get('many-sources-doc') as { count: number };
      expect(row.count).toBe(220);
    } finally {
      db.close();
    }
  });

  it('frontmatter source refs만으로 code boundary 모호성을 만들지 않는다', async () => {
    const rootDir = makeTempDir();
    const docsDir = join(rootDir, 'docs');
    const dataDir = join(rootDir, 'data');
    mkdirSync(docsDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    for (const [id, aspect] of [
      ['first-source-doc', 'func_def'],
      ['second-source-doc', 'func_def'],
    ] as const) {
      writeFileSync(
        join(docsDir, `${id}.md`),
        `---
def:
  id: ${id}
  tier: component
  scope: feature
  aspect: ${aspect}
  depth: specification
  lifecycle: approved
sources:
  - packages/demo/src/shared.ts
---
# ${id}

## 목적 ^purpose

공유 구현 소스의 문서 증거.
`,
        'utf8',
      );
    }

    await syncDocsToLocalDb({ rootDir });
    const source = new LocalDataSource(join(rootDir, 'data/definition-service.sqlite'), rootDir);
    try {
      const mapping = await source.resolveByFile('packages/demo/src/shared.ts');
      expect(mapping.kind).toBe('evidence-only');
      if (mapping.kind === 'evidence-only') {
        expect(mapping.supportingDocs.map((doc) => doc.docId)).toEqual([
          'first-source-doc',
          'second-source-doc',
        ]);
      }

      const result = await source.validate();
      expect(result.issues.filter((issue) => issue.type === 'ambiguous-code-boundary')).toEqual([]);
    } finally {
      source.close();
    }
  });
});
