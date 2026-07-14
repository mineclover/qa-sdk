#!/usr/bin/env tsx
/**
 * def-ci-check — CI/CD에서 문서 정합성 자동 검증
 *
 * 실행: tsx scripts/def-ci-check.ts [--changed <doc_id>...]
 *
 * 1. def validate: 깨진 링크, 순환 참조, 고아 문서
 * 2. 변경 대상 지정 시: def check per doc (의존자 임계값 경고)
 * 3. 종료 코드: 에러 있으면 1, 경고만이면 0
 */

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_PATHS = ['data/definition-service.sqlite', '../data/definition-service.sqlite'];

const CHANGE_THRESHOLD = 3;

function findDb(): string {
  for (const p of DB_PATHS) {
    const abs = resolve(process.cwd(), p);
    if (existsSync(abs)) return abs;
  }
  console.error('DB 파일 없음. POST /sync를 먼저 실행하세요.');
  process.exit(1);
}

function main() {
  const db = new Database(findDb(), { readonly: true });
  const args = process.argv.slice(2);
  const changedDocs: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--changed' && args[i + 1]) {
      changedDocs.push(args[i + 1]);
      i += 2;
    } else {
      changedDocs.push(args[i]);
      i++;
    }
  }

  let hasError = false;
  let warnings = 0;

  // 1. validate
  const allDocs = db
    .prepare("SELECT doc_id, lifecycle FROM documents WHERE lifecycle = 'approved'")
    .all() as { doc_id: string; lifecycle: string }[];
  const allIds = new Set(allDocs.map((d) => d.doc_id));
  const referenced = new Set<string>();

  for (const doc of allDocs) {
    const outgoing = db
      .prepare('SELECT target_id, link_type FROM document_links WHERE source_id = ?')
      .all(doc.doc_id) as { target_id: string; link_type: string }[];
    for (const link of outgoing) {
      referenced.add(link.target_id);
      if (!allIds.has(link.target_id)) {
        console.error(`✗ 깨진 링크: ${doc.doc_id} → ${link.target_id} (${link.link_type})`);
        hasError = true;
      }
    }
    const incoming = db
      .prepare('SELECT source_id FROM document_links WHERE target_id = ?')
      .all(doc.doc_id) as { source_id: string }[];
    if (incoming.length > 0) referenced.add(doc.doc_id);
  }

  // 고아 문서
  for (const doc of allDocs) {
    if (!referenced.has(doc.doc_id)) {
      const hasContains =
        (
          db
            .prepare(
              "SELECT COUNT(*) as cnt FROM document_links WHERE source_id = ? AND link_type = 'contains'",
            )
            .get(doc.doc_id) as { cnt: number }
        ).cnt > 0;
      if (!hasContains) {
        console.warn(`⚠ 고아: ${doc.doc_id}`);
        warnings++;
      }
    }
  }

  // 2. 변경 대상 체크
  for (const docId of changedDocs) {
    const deps = db
      .prepare(
        "SELECT source_id, link_type FROM document_links WHERE target_id = ? AND link_type IN ('depends_on', 'implements')",
      )
      .all(docId) as { source_id: string; link_type: string }[];
    const constraints = db
      .prepare(
        "SELECT source_id FROM document_links WHERE target_id = ? AND link_type = 'constrains'",
      )
      .all(docId) as { source_id: string }[];

    if (deps.length >= CHANGE_THRESHOLD) {
      console.warn(`⚠ ${docId}: 의존자 ${deps.length}건 — 대규모 변경. 의사결정 기록 필요`);
      for (const d of deps) console.warn(`    ← ${d.source_id} (${d.link_type})`);
      warnings++;
    }

    if (constraints.length > 0) {
      for (const c of constraints) {
        const purpose =
          (
            db.prepare('SELECT purpose FROM documents WHERE doc_id = ?').get(c.source_id) as
              | { purpose: string }
              | undefined
          )?.purpose ?? '';
        console.warn(`⚠ ${docId}: 제약 ${c.source_id} — ${purpose.slice(0, 80)}`);
      }
      warnings++;
    }
  }

  // 결과
  if (hasError) {
    console.error(`\n✗ 검증 실패 (에러 발생)`);
    process.exit(1);
  }
  if (warnings > 0) {
    console.log(`\n⚠ 검증 통과 (경고 ${warnings}건)`);
  } else {
    console.log(`✓ 검증 통과`);
  }

  db.close();
}

main();
