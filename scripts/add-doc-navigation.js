#!/usr/bin/env node
/**
 * 문서에 ^navigation 섹션을 자동 추가하는 스크립트.
 *
 * 사용법:
 *   node scripts/add-doc-navigation.js docs/specs/dkg-system
 *   node scripts/add-doc-navigation.js docs/specs/skill-catalog
 *   node scripts/add-doc-navigation.js docs/specs  (전체)
 *
 * ^purpose 앞에 breadcrumb + 형제 목록을 삽입한다.
 * 이미 ^navigation이 있으면 스킵.
 */

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node scripts/add-doc-navigation.js <dir>');
  process.exit(1);
}

const absDir = path.resolve(targetDir);

// 재귀적으로 .md 파일 수집
function collectMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const files = collectMdFiles(absDir);

// 1. id, level, contains targets 수집
const docs = {};
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const idMatch = content.match(/^  id: (.+)$/m);
  if (!idMatch) continue;
  const id = idMatch[1].trim();
  const levelMatch = content.match(/level: (.+)$/m);
  const level = levelMatch ? levelMatch[1].trim() : 'leaf';

  const children = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('type: contains') && i > 0) {
      const tMatch = lines[i - 1].match(/target: (.+)/);
      if (tMatch) children.push(tMatch[1].trim());
    }
  }
  docs[id] = { file, level, children };
}

// 2. parent 맵
const parentMap = {};
for (const [id, doc] of Object.entries(docs)) {
  for (const child of doc.children) {
    parentMap[child] = id;
  }
}

// 3. 각 문서에 ^navigation 삽입
let count = 0;
for (const [id, doc] of Object.entries(docs)) {
  let content = fs.readFileSync(doc.file, 'utf8');
  if (content.includes('^navigation')) continue;

  const parent = parentMap[id];
  if (!parent || !docs[parent]) continue;

  // breadcrumb
  const chain = [id];
  let cur = parent;
  while (cur && docs[cur]) {
    chain.unshift(cur);
    cur = parentMap[cur];
  }
  const breadcrumb = chain.map((c, i) => (i === chain.length - 1 ? `**${c}**` : c)).join(' > ');

  // 형제
  const siblings = (docs[parent]?.children || []).filter((c) => c !== id);
  const sibStr = siblings.map((s) => `\`${s}\``).join(' · ');

  let navBlock = `\n## 탐색 ^navigation\n\n${breadcrumb}`;
  if (sibStr) navBlock += `\n\n형제: ${sibStr}`;
  navBlock += '\n';

  // ^purpose 앞에 삽입
  const purposeIdx = content.indexOf('^purpose');
  if (purposeIdx === -1) continue;
  const beforePurpose = content.lastIndexOf('## ', purposeIdx);
  if (beforePurpose === -1) continue;

  content = content.slice(0, beforePurpose) + navBlock + '\n' + content.slice(beforePurpose);
  fs.writeFileSync(doc.file, content);
  count++;
  console.log(`  ✅ ${id}: ${breadcrumb}`);
}
console.log(`\n  총 ${count}개 문서에 ^navigation 추가`);
