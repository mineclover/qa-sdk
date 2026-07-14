/**
 * gen-skill-docs.mjs
 *
 * Claude Code skills + DKG skills + CLI commands를 experience 계층 문서로 생성한다.
 * 코드에서 파생 가능한 것(명령어, 파라미터)은 참조만 두고,
 * 의도/맥락/피드백 규칙은 사람이 작성하는 지점으로 비워둔다.
 *
 * 사용법:
 *   node scripts/gen-skill-docs.mjs [--dry-run]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../..');
const OUT_DIR = join(ROOT, 'docs/specs/skill-catalog');
const SKILLS_DIR = join(ROOT, '../.claude/skills'); // Claude Code skills 위치 (홈)
const HOME_SKILLS = join(process.env.HOME ?? '', '.claude/skills');
const DRY_RUN = process.argv.includes('--dry-run');

if (!DRY_RUN && !existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// ── Claude Code Skills (def-*) ──────────────────────────

const CLAUDE_SKILLS = [
  {
    id: 'def-topdown',
    name: '탑다운 조회',
    desc: '시스템/그룹에서 시작하여 멤버 purpose/overview를 scope 순서로 조립',
    category: 'query',
  },
  {
    id: 'def-bottomup',
    name: '바텀업 역추적',
    desc: '특정 문서 변경 시 영향받는 문서를 역추적 (blast radius)',
    category: 'analysis',
  },
  {
    id: 'def-context',
    name: '노드 컨텍스트 조회',
    desc: '문서 작업 전 상위/하위/제약/의존/concern 정보 수집',
    category: 'query',
  },
  {
    id: 'def-audit',
    name: '문서 품질 감사',
    desc: 'purpose 품질, 링크 누락, 태그 미부여, 마커 미사용 점검',
    category: 'analysis',
  },
  {
    id: 'def-new',
    name: '새 문서 생성',
    desc: 'frontmatter + ^purpose + ^overview 형식으로 새 스펙 문서 생성',
    category: 'write',
  },
  {
    id: 'def-link',
    name: '링크 연결',
    desc: '고아 문서에 depends_on/implements/refines/constrains 관계 추가',
    category: 'write',
  },
  {
    id: 'def-split',
    name: '대형 문서 분할',
    desc: '150줄 이상 리프 문서를 scope별 그룹 + 멤버로 분할',
    category: 'write',
  },
];

// ── DKG Skills ──────────────────────────────────────────

const DKG_SKILLS = [
  {
    id: 'dkg-skill-cascade',
    name: '변경 영향 전파',
    desc: '노드 변경이 리프까지 어떤 경로로 전파되는지 추적',
    category: 'analysis',
  },
  {
    id: 'dkg-skill-migrator',
    name: '마이그레이션 추론',
    desc: '축/prefix 변경 시 자동 마이그레이션 경로 추론',
    category: 'chain',
  },
  {
    id: 'dkg-skill-version-event',
    name: '버전 이벤트 생성',
    desc: '변경 diff에서 VersionEvent 자동 생성',
    category: 'write',
  },
  {
    id: 'dkg-skill-decision',
    name: '의사결정 템플릿',
    desc: 'Decision 템플릿 자동 생성 + evidence 수집',
    category: 'write',
  },
  {
    id: 'dkg-skill-catalog',
    name: '스킬 카탈로그',
    desc: '스킬 등록/조회/실행 레지스트리',
    category: 'read',
  },
];

// ── CLI Command Groups ──────────────────────────────────

const CLI_GROUPS = [
  {
    id: 'cli-def-commands',
    name: 'Definition CLI',
    desc: '문서 관리 명령: scan, topdown, bottomup, context, audit, validate, stats',
    category: 'interface',
  },
  {
    id: 'cli-dkg-commands',
    name: 'DKG CLI',
    desc: 'DKG 그래프 관리: report, axes, prefixes, skills, decide, observe, refresh',
    category: 'interface',
  },
  {
    id: 'cli-flow-commands',
    name: 'Decision Flow CLI',
    desc: '의사결정 흐름: list, start, select, status, trace, analyze, compare',
    category: 'interface',
  },
  {
    id: 'cli-coord-commands',
    name: 'Coordinate CLI',
    desc: '좌표 연산: encode, decode, resolve, find-version, impact',
    category: 'interface',
  },
];

// ── 문서 생성 ───────────────────────────────────────────

function generateSkillDoc(skill, group) {
  const sourceRef =
    group === 'claude'
      ? `~/.claude/skills/${skill.id}/SKILL.md`
      : group === 'dkg'
        ? `packages/spec-core/src/dkg/skills/`
        : `packages/cli/src/commands/`;

  return `---
def:
  id: skill-${skill.id}
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
---

## 목적 ^purpose

<!-- ${skill.name} — ${skill.desc} -->
<!-- 이 skill이 사용자에게 어떤 가치를 주는가? 코드 설명이 아닌 "왜 이 도구가 필요한가"를 작성 -->

## 사용 맥락 ^context

<!-- 언제 이 skill을 쓰는가? 어떤 상황에서 이 skill이 가장 유용한가? -->
<!-- 예: "새 서비스를 추가할 때 영향 범위를 먼저 확인하려면 def-bottomup을 실행한다" -->

## 설계 의도 ^intent

<!-- 왜 이 방식으로 유도하는가? 다른 접근은 왜 부적합한가? -->
<!-- 예: "scope 순서 정렬은 constraint→data→feature 순으로 읽어야 구조가 보이기 때문" -->

## 피드백 규칙 ^feedback

<!-- CLI 사용 패턴에 따라 이 skill을 어떻게 개선하는가? -->
<!-- 예: "blast radius가 50 이상이면 분할 제안을 추가한다" -->
<!-- 예: "같은 그룹을 3번 이상 topdown하면 즐겨찾기 제안" -->

## 주의사항 ^caveat

<!-- 알려진 한계, 오용 패턴, 잘못된 기대 -->

## 관련 소스

- ${sourceRef}
`;
}

function generateGroupDoc(groupId, groupName, groupDesc, memberIds) {
  const links = memberIds.map((id) => `    - target: skill-${id}\n      type: contains`).join('\n');

  return `---
def:
  id: ${groupId}
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
${links}
---

## 목적 ^purpose

${groupDesc}

## 구성 ^overview

${memberIds.map((id) => `- \`${id}\``).join('\n')}
`;
}

// ── 루트 문서 ───────────────────────────────────────────

function generateRootDoc(groupIds) {
  const links = groupIds.map((id) => `    - target: ${id}\n      type: contains`).join('\n');

  return `---
def:
  id: skill-catalog-system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
${links}
---

## 목적 ^purpose

사용자가 시스템과 상호작용하는 모든 skill/CLI 도구를 experience 계층으로 관리한다.
각 skill 문서에는 코드에서 파생할 수 없는 의도/맥락/피드백 규칙을 기록한다.

## 구성 ^overview

- claude-skill-group: Claude Code skills (def-topdown 등 7개)
- dkg-skill-group: DKG 자동화 skills (cascade 등 5개)
- cli-command-group: CLI 명령 그룹 (def/dkg/flow/coord 4개)

## 피드백 루프 ^feedback

CLI 사용 패턴 → emitCliEvent → 소비율 분석 → skill 문서의 ^feedback 규칙 갱신
- dormant skill (사용률 < 5%) → 폐기 검토 또는 접근성 개선
- hot skill (사용률 > 50%) → 자동화/단축키 후보
- error rate 높은 skill → ^caveat 보강
`;
}

// ── main ────────────────────────────────────────────────

let totalWritten = 0;

// 1. Claude Code skill 문서
for (const s of CLAUDE_SKILLS) {
  const content = generateSkillDoc(s, 'claude');
  const filename = `skill-${s.id}.spec.md`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${filename}`);
  } else {
    writeFileSync(join(OUT_DIR, filename), content);
    totalWritten++;
  }
}

// 2. DKG skill 문서
for (const s of DKG_SKILLS) {
  const content = generateSkillDoc(s, 'dkg');
  const filename = `skill-${s.id}.spec.md`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${filename}`);
  } else {
    writeFileSync(join(OUT_DIR, filename), content);
    totalWritten++;
  }
}

// 3. CLI command group 문서
for (const g of CLI_GROUPS) {
  const content = generateSkillDoc(g, 'cli');
  const filename = `skill-${g.id}.spec.md`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${filename}`);
  } else {
    writeFileSync(join(OUT_DIR, filename), content);
    totalWritten++;
  }
}

// 4. 그룹 문서
const groups = [
  {
    id: 'claude-skill-group',
    name: 'Claude Code Skills',
    desc: 'Claude Code에서 사용하는 definition-catalog 관리 도구 7종',
    members: CLAUDE_SKILLS.map((s) => s.id),
  },
  {
    id: 'dkg-skill-group',
    name: 'DKG Skills',
    desc: 'DKG 그래프 자동화 도구 5종',
    members: DKG_SKILLS.map((s) => s.id),
  },
  {
    id: 'cli-command-group',
    name: 'CLI Commands',
    desc: 'qa-sdk CLI 명령 그룹 4종',
    members: CLI_GROUPS.map((g) => g.id),
  },
];

for (const g of groups) {
  const content = generateGroupDoc(g.id, g.name, g.desc, g.members);
  const filename = `${g.id}.md`;
  if (DRY_RUN) {
    console.log(`[dry-run] ${filename} (${g.members.length} members)`);
  } else {
    writeFileSync(join(OUT_DIR, filename), content);
    totalWritten++;
  }
}

// 5. 루트 문서
const rootContent = generateRootDoc(groups.map((g) => g.id));
if (DRY_RUN) {
  console.log(`[dry-run] skill-catalog-system.md (root)`);
} else {
  writeFileSync(join(OUT_DIR, 'skill-catalog-system.md'), rootContent);
  totalWritten++;
}

console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}${OUT_DIR}에 ${totalWritten}건 생성`);
console.log(`  Claude skills: ${CLAUDE_SKILLS.length}개`);
console.log(`  DKG skills: ${DKG_SKILLS.length}개`);
console.log(`  CLI groups: ${CLI_GROUPS.length}개`);
console.log(`  그룹: ${groups.length}개 + 루트 1개`);
