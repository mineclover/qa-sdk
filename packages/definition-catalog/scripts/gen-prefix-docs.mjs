/**
 * gen-prefix-docs.mjs
 *
 * DEMO_CATALOG에서 prefix/axis 정의를 읽어 markdown 문서를 자동 생성한다.
 * 문서 관리 체계(definition-catalog)에 편입하기 위한 frontmatter + 마커 포함.
 *
 * 사용법:
 *   node scripts/gen-prefix-docs.mjs [--dry-run]
 *
 * 출력 디렉토리:
 *   docs/specs/prefix-catalog/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../..');
const OUT_DIR = join(ROOT, 'docs/specs/prefix-catalog');
const DRY_RUN = process.argv.includes('--dry-run');

// ── DEMO_CATALOG 로딩 (빌드된 dist 사용) ──────────────────

async function loadCatalog() {
  // demo-snapshot의 빌드 산출물에서 DEMO_CATALOG import
  const snapshotPath = join(ROOT, 'packages/demo-snapshot/dist/index.js');
  if (!existsSync(snapshotPath)) {
    console.error('demo-snapshot 빌드 필요: pnpm --filter demo-snapshot build');
    process.exit(1);
  }
  const mod = await import(snapshotPath);
  return mod.DEMO_CATALOG;
}

// ── 도메인 그룹 분류 ────────────────────────────────────

const DOMAIN_GROUPS = {
  entity: {
    id: 'entity-prefix-group',
    name: '엔티티 Prefix 그룹',
    desc: '서비스/콘텐츠 등 실체 prefix',
  },
  event: {
    id: 'event-prefix-group',
    name: '이벤트 Prefix 그룹',
    desc: '시스템/비즈니스 이벤트 prefix',
  },
  observation: {
    id: 'observation-prefix-group',
    name: '관측 Prefix 그룹',
    desc: '화면/엔드포인트/흐름 관측 prefix',
  },
  policy: { id: 'policy-prefix-group', name: '정책 Prefix 그룹', desc: '권한/접근 제어 prefix' },
  relation: {
    id: 'relation-prefix-group',
    name: '관계 Prefix 그룹',
    desc: 'DKG/온톨로지 관계 prefix',
  },
  state: { id: 'state-prefix-group', name: '상태 Prefix 그룹', desc: '상태 모델 prefix' },
};

// ── dim 설명 헬퍼 ────────────────────────────────────────

function describeDim(dimName, dimRef) {
  if (dimRef.kind === 'axis') return `${dimName}: axis(${dimRef.axisId})`;
  if (dimRef.kind === 'prefix_ref') return `${dimName}: prefix_ref(${dimRef.prefixId})`;
  if (dimRef.kind === 'table_ref') return `${dimName}: table_ref(${dimRef.table})`;
  return `${dimName}: ${dimRef.kind}`;
}

function dimConstraint(dimRef) {
  if (dimRef.kind === 'prefix_ref') {
    return `- ${dimRef.prefixId} prefix의 refEntries에 존재해야 함 (CON-006)`;
  }
  return null;
}

// ── prefix 문서 생성 ────────────────────────────────────

function generatePrefixDoc(prefix, catalog) {
  const category = prefix.meta?.category ?? 'entity';
  const dimList = Object.entries(prefix.dims);
  const versionCount = prefix.versions.length;

  // ── prefix_ref → depends_on 링크 수집 ──
  const depLinks = [];
  for (const [name, ref] of dimList) {
    if (ref.kind === 'prefix_ref') {
      depLinks.push({ target: `prefix-${ref.prefixId}`, type: 'depends_on', dim: name });
    }
  }

  // ── 공유 axis 기반 관계 수집 (같은 axis를 쓰는 다른 prefix) ──
  const sharedAxisPrefixes = new Set();
  for (const [, ref] of dimList) {
    if (ref.kind === 'axis') {
      for (const otherPrefix of Object.values(catalog.prefixes)) {
        if (otherPrefix.id === prefix.id) continue;
        for (const otherRef of Object.values(otherPrefix.dims)) {
          if (otherRef.kind === 'axis' && otherRef.axisId === ref.axisId) {
            sharedAxisPrefixes.add(otherPrefix.id);
          }
        }
      }
    }
  }

  // ── frontmatter links 조립 ──
  let linksYaml = '';
  if (depLinks.length > 0) {
    const linkLines = depLinks
      .map((l) => `    - target: ${l.target}\n      type: depends_on`)
      .join('\n');
    linksYaml = `\n  links:\n${linkLines}`;
  }

  // ── capacity 계산 (axis dims만) ──
  const axisCapacities = [];
  for (const [name, ref] of dimList) {
    if (ref.kind === 'axis') {
      const axis = catalog.axes[ref.axisId];
      if (axis) {
        const ver = Object.values(axis.versions)[0];
        const cap = ver?.capacity ?? ver?.entries?.length ?? '?';
        axisCapacities.push(`${name}(${cap})`);
      }
    }
  }
  const capacityNote = axisCapacities.length > 0 ? `- capacity: ${axisCapacities.join(' × ')}` : '';

  // ── constraint 수집 ──
  const constraints = dimList.map(([name, ref]) => dimConstraint(ref)).filter(Boolean);

  // ── 공유 axis 요약 (상위 5개) ──
  const sharedList = [...sharedAxisPrefixes].slice(0, 5);
  const sharedNote =
    sharedList.length > 0
      ? `- 축 공유: ${sharedList.map((id) => `\`${id}\``).join(', ')}${sharedAxisPrefixes.size > 5 ? ` 외 ${sharedAxisPrefixes.size - 5}개` : ''}`
      : '';

  // ── 코드 참조 (인라인이 아닌 위치만) ──
  const sourceRef = `packages/demo-snapshot/src/demo-catalog.ts:DEMO_CATALOG.prefixes.${prefix.id}`;
  const implRef =
    prefix.meta?.source?.module && prefix.meta?.source?.file
      ? `packages/${prefix.meta.source.module}/src/${prefix.meta.source.file}`
      : null;

  const doc = `---
def:
  tier: component
  id: prefix-${prefix.id}
  scope: data
  aspect: prefix_schema
  depth: specification
  lifecycle: approved
  tags: [generated]${linksYaml}
source: ${sourceRef}
---

## 목적 ^purpose

<!-- ${prefix.name} (${prefix.id}) — ${dimList.length}차원 ${category} prefix -->
<!-- 이 prefix가 존재하는 이유를 작성한다. 코드의 description을 복사하지 않는다. -->
<!-- 어떤 비즈니스/운영 질문에 답하기 위해 이 좌표 공간이 필요한가? -->

## 설계 근거 ^intent

<!-- 왜 이 차원 조합인가? 다른 후보 차원은 왜 제외했는가? -->
<!-- 이 prefix로 무엇을 관측/판단/제어하려는가? -->
<!-- 예: "사용자 행동과 시스템 응답의 교차점을 관측하여 전환율 저하 원인을 식별한다" -->

## 사용 맥락 ^context

<!-- 어떤 시나리오/서비스에서 이 prefix가 사용되는가? -->
<!-- IntentLink나 ScenarioSpec에서 이 prefix가 어떤 역할을 하는가? -->
<!-- 예: "checkout-flow IntentLink에서 page_view + endpoint + order_event와 함께 관측된다" -->

## 주의사항 ^caveat

<!-- 알려진 한계, 엣지 케이스, 마이그레이션 주의점 -->
<!-- 예: "v1→v2 전환 시 page axis headroom이 2로 좁다. capacity 확장 필요할 수 있다" -->

## 관련 소스

${implRef && implRef !== sourceRef ? `- ${implRef}\n` : ''}- ${sourceRef}
`;

  return doc.trim() + '\n';
}

// ── 그룹 문서 생성 ──────────────────────────────────────

function generateGroupDoc(group, memberIds) {
  const links = memberIds
    .map((id) => `    - target: prefix-${id}\n      type: contains`)
    .join('\n');

  const doc = `---
def:
  tier: system
  id: ${group.id}
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
${links}
  sources:
    - packages/definition-catalog/scripts/gen-prefix-docs.mjs
    - packages/demo-snapshot/src/demo-catalog.ts
    - packages/demo-snapshot/src/demo-catalog.test.ts
    - packages/demo-types/src/prefix-ids.ts
    - packages/demo-types/src/lifecycle.test.ts
---

## 목적 ^purpose

${group.desc}
category: ${group.id.replace('-prefix-group', '')}에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

${memberIds.map((id) => `- \`${id}\``).join('\n')}

## 검증 ^consumes

\`\`\`bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
\`\`\`
`;

  return doc.trim() + '\n';
}

// ── prefix-catalog 루트 문서 ─────────────────────────────

function generateRootDoc(groupIds, totalPrefixes) {
  const groupLinks = [
    ...groupIds.map((id) => `    - target: ${id}\n      type: depends_on`),
    ...groupIds.map((id) => `    - target: ${id}\n      type: refs`),
  ].join('\n');

  const doc = `---
def:
  tier: layout
  id: prefix-catalog-system
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
${groupLinks}
  sources:
    - packages/definition-catalog/scripts/gen-prefix-docs.mjs
    - packages/demo-snapshot/src/demo-catalog.ts
    - packages/demo-snapshot/src/demo-catalog.test.ts
    - packages/demo-types/src/prefix-ids.ts
    - packages/demo-types/src/lifecycle.test.ts
---

## 목적 ^purpose

좌표 시스템의 모든 prefix 정의를 문서 관리 체계로 통합 관리한다.
DEMO_CATALOG이 코드 SSOT이고, 이 문서 체계는 탐색/조립/영향분석을 위한 파생 인덱스다.

## 구성 ^overview

- 총 ${totalPrefixes}개 prefix
- ${groupIds.length}개 도메인 그룹: ${groupIds.map((id) => id.replace('-prefix-group', '')).join(', ')}
- 자동 생성: scripts/gen-prefix-docs.mjs

## 검증 ^consumes

\`\`\`bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
\`\`\`
`;

  return doc.trim() + '\n';
}

// ── main ────────────────────────────────────────────────

async function main() {
  const catalog = await loadCatalog();
  const prefixes = Object.values(catalog.prefixes);

  console.log(
    `DEMO_CATALOG: ${prefixes.length}개 prefix, ${Object.keys(catalog.axes).length}개 axis`,
  );

  // 도메인별 분류
  const groups = {};
  for (const p of prefixes) {
    const cat = p.meta?.category ?? 'entity';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  if (!DRY_RUN) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  let totalWritten = 0;

  // 1. 개별 prefix 문서 생성
  for (const p of prefixes) {
    const cat = p.meta?.category ?? 'entity';
    const group = DOMAIN_GROUPS[cat];
    const filename = `prefix-${p.id}.spec.md`;
    const content = generatePrefixDoc(p, catalog);
    const outputDir = group ? join(OUT_DIR, group.id) : OUT_DIR;

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${group ? `${group.id}/` : ''}${filename} (${content.split('\n').length}줄)`,
      );
    } else {
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, filename), content);
      totalWritten++;
    }
  }

  // 2. 도메인 그룹 문서 생성
  const usedGroupIds = [];
  for (const [cat, members] of Object.entries(groups)) {
    const group = DOMAIN_GROUPS[cat];
    if (!group) {
      console.warn(`알 수 없는 category: ${cat} (${members.length}건)`);
      continue;
    }
    usedGroupIds.push(group.id);

    const memberIds = members.map((p) => p.id);
    const filename = `${group.id}.md`;
    const content = generateGroupDoc(group, memberIds);

    if (DRY_RUN) {
      console.log(`[dry-run] ${filename} — ${memberIds.length}개 멤버`);
    } else {
      writeFileSync(join(OUT_DIR, filename), content);
      totalWritten++;
    }
  }

  // 3. 루트 문서 생성
  const rootContent = generateRootDoc(usedGroupIds, prefixes.length);
  if (DRY_RUN) {
    console.log(`[dry-run] prefix-catalog-system.md — 루트`);
  } else {
    writeFileSync(join(OUT_DIR, 'prefix-catalog-system.md'), rootContent);
    totalWritten++;
  }

  // 요약
  console.log('');
  for (const [cat, members] of Object.entries(groups)) {
    console.log(`  ${cat}: ${members.map((p) => p.id).join(', ')}`);
  }
  console.log('');
  console.log(
    DRY_RUN
      ? `[dry-run] ${prefixes.length}개 prefix + ${usedGroupIds.length}개 그룹 + 1 루트 (실제 쓰기 안 함)`
      : `${OUT_DIR}에 ${totalWritten}건 생성 완료`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
