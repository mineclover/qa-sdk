#!/usr/bin/env node

/**
 * Architecture Governance Validator
 * Architecture Definition Operating System v0.1
 *
 * 실행:
 *   node architecture/validation/validate.mjs
 *   node architecture/validation/validate.mjs --verbose
 *   node architecture/validation/validate.mjs --rule SR-001
 *   node architecture/validation/validate.mjs --category governance/structure
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ARCH_ROOT = resolve(__dirname, '..');
const GOV_ROOT = join(ARCH_ROOT, 'docs', 'governance');
const MODEL_PATH = join(ARCH_ROOT, 'model', 'archi-adr.yaml');

// ---------------------------------------------------------------------------
// Minimal YAML frontmatter parser (no deps)
// ---------------------------------------------------------------------------

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result = {};
  const lines = yaml.split('\n');

  let currentKey = null;
  let currentIndent = 0;
  let nested = null;
  let nestedKey = null;
  let arrayKey = null;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Array item
    const arrayMatch = line.match(/^(\s*)- (.+)$/);
    if (arrayMatch && arrayKey) {
      if (!result[arrayKey]) result[arrayKey] = [];
      result[arrayKey].push(arrayMatch[2].trim());
      continue;
    }

    // Key: value
    const kvMatch = line.match(/^(\s*)(\w[\w_-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const indent = kvMatch[1].length;
      const key = kvMatch[2];
      let value = kvMatch[3].trim();

      if (indent === 0) {
        // Top-level key
        if (value === '') {
          // Could be nested object or array
          currentKey = key;
          nested = {};
          nestedKey = key;
          arrayKey = null;
        } else {
          result[key] = parseValue(value);
          currentKey = key;
          nested = null;
          nestedKey = null;
          arrayKey = null;
        }
      } else if (indent > 0 && nestedKey) {
        // Nested key
        if (value === '') {
          arrayKey = null;
        } else {
          nested[key] = parseValue(value);
        }
        result[nestedKey] = nested;
        arrayKey = null;
      }

      // Detect array start
      if (value === '' && indent === 0) {
        arrayKey = key;
      }
    }
  }

  return result;
}

function parseValue(v) {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  return v;
}

// ---------------------------------------------------------------------------
// Minimal YAML model parser (for archi-adr.yaml)
// ---------------------------------------------------------------------------

function parseModel(content) {
  const model = {
    scopes: [],
    elements: [],
    relations: [],
    views: [],
  };

  // Extract scope IDs
  const scopeRegex = /^\s{2}- id:\s+(\S+)/gm;
  const scopeSection = content.match(/^scopes:\n([\s\S]*?)(?=\n\w|\n# ===)/m);
  if (scopeSection) {
    let m;
    const re = /- id:\s+(\S+)/g;
    while ((m = re.exec(scopeSection[1]))) {
      model.scopes.push(m[1]);
    }
  }

  // Extract element IDs
  const elemSection = content.match(/^elements:\n([\s\S]*?)(?=\n# ===|\nrelations:)/m);
  if (elemSection) {
    const re = /- id:\s+(\S+)/g;
    let m;
    while ((m = re.exec(elemSection[1]))) {
      model.elements.push(m[1]);
    }
  }

  // Extract relation IDs, sources, targets
  const relSection = content.match(/^relations:\n([\s\S]*?)(?=\n# ===|\nviews:)/m);
  if (relSection) {
    const blocks = relSection[1].split(/\n\s{2}- id:/);
    for (const block of blocks) {
      const idMatch = block.match(/^\s*(\S+)/);
      const srcMatch = block.match(/source:\s+(\S+)/);
      const tgtMatch = block.match(/target:\s+(\S+)/);
      if (idMatch && srcMatch && tgtMatch) {
        model.relations.push({
          id: idMatch[1],
          source: srcMatch[1],
          target: tgtMatch[1],
        });
      }
    }
  }

  // Extract view IDs and their element/relation refs
  const viewSection = content.match(/^views:\n([\s\S]*?)(?=\n# ===|\nvalidation:)/m);
  if (viewSection) {
    const viewBlocks = viewSection[1].split(/\n\s{2}- id:/);
    for (const block of viewBlocks) {
      const idMatch = block.match(/^\s*(\S+)/);
      if (!idMatch) continue;
      const view = { id: idMatch[1], elements: [], relations: [] };

      const elemsMatch = block.match(/elements:\n((?:\s+- \S+\n?)*)/);
      if (elemsMatch) {
        const re = /- (\S+)/g;
        let m;
        while ((m = re.exec(elemsMatch[1]))) {
          view.elements.push(m[1]);
        }
      }

      const relsMatch = block.match(/relations:\n((?:\s+- \S+\n?)*)/);
      if (relsMatch) {
        const re = /- (\S+)/g;
        let m;
        while ((m = re.exec(relsMatch[1]))) {
          view.relations.push(m[1]);
        }
      }

      model.views.push(view);
    }
  }

  return model;
}

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

function findFiles(dir, pattern = '*.md') {
  const results = [];
  if (!existsSync(dir)) return results;

  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.md') && entry !== '.gitkeep') {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function readFrontmatter(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return { path: filePath, content, frontmatter: parseFrontmatter(content) };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const validators = {
  /** SR-001: governance/current.md는 각 영역별 하나만 존재해야 한다 */
  'SR-001'(ctx) {
    const areas = ['roadmap', 'prd', 'progress', 'handoff'];
    const results = [];

    for (const area of areas) {
      const dir = join(GOV_ROOT, area);
      if (!existsSync(dir)) {
        results.push({
          ok: false,
          message: `${area}/: 디렉토리 없음`,
        });
        continue;
      }

      const currents = readdirSync(dir).filter((f) => f === 'current.md');
      if (currents.length === 0) {
        results.push({
          ok: false,
          message: `${area}/: current.md 없음`,
        });
      } else if (currents.length > 1) {
        results.push({
          ok: false,
          message: `${area}/: current.md ${currents.length}개 존재`,
        });
      } else {
        results.push({
          ok: true,
          message: `${area}/current.md: 정상`,
        });
      }
    }
    return results;
  },

  /** SR-003: SessionHistoryDocument는 timeline.md에 등록되어야 한다 */
  'SR-003'(ctx) {
    const timelinePath = join(GOV_ROOT, 'timeline.md');
    if (!existsSync(timelinePath)) {
      return [{ ok: false, message: 'timeline.md 없음' }];
    }

    const timelineContent = readFileSync(timelinePath, 'utf-8');
    const sessionsDir = join(GOV_ROOT, 'sessions');
    const sessionFiles = findFiles(sessionsDir);
    const results = [];

    for (const f of sessionFiles) {
      const { frontmatter } = readFrontmatter(f);
      if (!frontmatter?.id) {
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, f)}: frontmatter.id 없음`,
        });
        continue;
      }

      const registered = timelineContent.includes(frontmatter.id);
      results.push({
        ok: registered,
        message: `${frontmatter.id}: ${registered ? 'timeline에 등록됨' : 'timeline에 미등록'}`,
      });
    }

    if (sessionFiles.length === 0) {
      results.push({ ok: true, message: '세션 파일 없음 (skip)' });
    }

    return results;
  },

  /** SR-004: HandoffDocument는 Next Recommended Actions 섹션 필수 */
  'SR-004'(ctx) {
    const results = [];
    for (const doc of ctx.govDocs) {
      if (doc.frontmatter?.type !== 'HandoffDocument') continue;
      const has = doc.content.includes('## Next Recommended Actions');
      results.push({
        ok: has,
        message: `${relative(ARCH_ROOT, doc.path)}: ${has ? '섹션 존재' : '## Next Recommended Actions 없음'}`,
      });
    }
    return results;
  },

  /** SR-005: HistoryIndexDocument는 Key Decisions + Important Files 필수 */
  'SR-005'(ctx) {
    const results = [];
    for (const doc of ctx.govDocs) {
      if (doc.frontmatter?.type !== 'HistoryIndexDocument') continue;
      const hasKeys = doc.content.includes('### Key Decisions');
      const hasFiles = doc.content.includes('### Important Files');
      if (!hasKeys)
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, doc.path)}: ### Key Decisions 없음`,
        });
      if (!hasFiles)
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, doc.path)}: ### Important Files 없음`,
        });
      if (hasKeys && hasFiles)
        results.push({
          ok: true,
          message: `${relative(ARCH_ROOT, doc.path)}: 필수 섹션 모두 존재`,
        });
    }
    return results;
  },

  /** SR-006: active 상태 문서는 current.md 또는 참조 문서 */
  'SR-006'(ctx) {
    const results = [];
    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter) continue;
      // lifecycle.state 파싱 — 간단한 접근
      const stateMatch = doc.content.match(/state:\s+(draft|active|resolved|deprecated|archived)/);
      const state = stateMatch?.[1];
      if (state !== 'active') continue;

      const isCurrent = basename(doc.path) === 'current.md';
      const isTimeline =
        basename(doc.path) === 'timeline.md' || basename(doc.path) === 'history-index.md';

      if (isCurrent || isTimeline) {
        results.push({
          ok: true,
          message: `${relative(ARCH_ROOT, doc.path)}: active + current/timeline 위치 정상`,
        });
      } else {
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, doc.path)}: active인데 current.md가 아님`,
        });
      }
    }
    return results;
  },

  /** SR-010: TimelineDocument는 시간순 append-only */
  'SR-010'(ctx) {
    const timelinePath = join(GOV_ROOT, 'timeline.md');
    if (!existsSync(timelinePath)) {
      return [{ ok: false, message: 'timeline.md 없음' }];
    }

    const content = readFileSync(timelinePath, 'utf-8');
    const dateHeaders = [...content.matchAll(/^## (\d{4}-\d{2}-\d{2})/gm)];
    const dates = dateHeaders.map((m) => m[1]);

    const sorted = [...dates].sort();
    const isOrdered = dates.every((d, i) => d === sorted[i]);

    return [
      {
        ok: isOrdered,
        message: isOrdered
          ? `timeline.md: ${dates.length}개 날짜 시간순 정상`
          : `timeline.md: 시간순 위반 — ${dates.join(', ')}`,
      },
    ];
  },

  /** SR-011: scope 필드는 정의된 Scope Unit 참조 필수 */
  'SR-011'(ctx) {
    const results = [];
    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter?.scope) continue;
      const scope = doc.frontmatter.scope;
      const valid = ctx.model.scopes.includes(scope);
      results.push({
        ok: valid,
        message: `${relative(ARCH_ROOT, doc.path)}: scope=${scope} ${valid ? '유효' : '미정의'}`,
      });
    }
    return results;
  },

  /** SR-013: Relation의 source/target은 유효한 Element ID */
  'SR-013'(ctx) {
    const elementIds = new Set(ctx.model.elements);
    const results = [];

    for (const rel of ctx.model.relations) {
      const srcValid = elementIds.has(rel.source);
      const tgtValid = elementIds.has(rel.target);

      if (!srcValid) {
        results.push({
          ok: false,
          message: `${rel.id}: source=${rel.source} 미존재`,
        });
      }
      if (!tgtValid) {
        results.push({
          ok: false,
          message: `${rel.id}: target=${rel.target} 미존재`,
        });
      }
      if (srcValid && tgtValid) {
        results.push({
          ok: true,
          message: `${rel.id}: source=${rel.source}, target=${rel.target} 유효`,
        });
      }
    }
    return results;
  },

  /** SR-014: View가 참조하는 Element/Relation이 존재해야 한다 */
  'SR-014'(ctx) {
    const elementIds = new Set(ctx.model.elements);
    const relationIds = new Set(ctx.model.relations.map((r) => r.id));
    const results = [];

    for (const view of ctx.model.views) {
      for (const eid of view.elements) {
        if (!elementIds.has(eid)) {
          results.push({
            ok: false,
            message: `View ${view.id}: element=${eid} 미존재`,
          });
        }
      }
      for (const rid of view.relations) {
        if (!relationIds.has(rid)) {
          results.push({
            ok: false,
            message: `View ${view.id}: relation=${rid} 미존재`,
          });
        }
      }
      if (
        view.elements.every((e) => elementIds.has(e)) &&
        view.relations.every((r) => relationIds.has(r))
      ) {
        results.push({
          ok: true,
          message: `View ${view.id}: 참조 ${view.elements.length}E + ${view.relations.length}R 모두 유효`,
        });
      }
    }
    return results;
  },

  /** SR-FRONTMATTER: 모든 governance 문서에 필수 frontmatter 필드 존재 */
  'SR-FRONTMATTER'(ctx) {
    const required = ['id', 'type', 'date'];
    const results = [];

    for (const doc of ctx.govDocs) {
      if (!doc.frontmatter) {
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, doc.path)}: frontmatter 없음`,
        });
        continue;
      }

      const missing = required.filter((k) => !doc.frontmatter[k]);
      if (missing.length > 0) {
        results.push({
          ok: false,
          message: `${relative(ARCH_ROOT, doc.path)}: 누락 필드 — ${missing.join(', ')}`,
        });
      } else {
        results.push({
          ok: true,
          message: `${relative(ARCH_ROOT, doc.path)}: 필수 필드 모두 존재`,
        });
      }
    }
    return results;
  },
};

// ---------------------------------------------------------------------------
// Rule metadata (from semantic-rules.yaml mapping)
// ---------------------------------------------------------------------------

const ruleMeta = {
  'SR-001': {
    name: 'unique-current',
    category: 'governance/structure',
    severity: 'error',
  },
  'SR-003': {
    name: 'session-timeline-registration',
    category: 'governance/content',
    severity: 'error',
  },
  'SR-004': {
    name: 'handoff-next-actions',
    category: 'governance/content',
    severity: 'error',
  },
  'SR-005': {
    name: 'history-index-completeness',
    category: 'governance/content',
    severity: 'error',
  },
  'SR-006': {
    name: 'active-current-alignment',
    category: 'governance/lifecycle',
    severity: 'warning',
  },
  'SR-010': {
    name: 'timeline-append-only',
    category: 'governance/content',
    severity: 'error',
  },
  'SR-011': {
    name: 'scope-reference-valid',
    category: 'governance/lifecycle',
    severity: 'error',
  },
  'SR-013': {
    name: 'relation-source-target-valid',
    category: 'model/integrity',
    severity: 'error',
  },
  'SR-014': {
    name: 'view-element-exists',
    category: 'model/integrity',
    severity: 'error',
  },
  'SR-FRONTMATTER': {
    name: 'frontmatter-required-fields',
    category: 'governance/structure',
    severity: 'error',
  },
};

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

const ICONS = {
  pass: '\x1b[32m✓\x1b[0m',
  fail: '\x1b[31m✗\x1b[0m',
  warn: '\x1b[33m⚠\x1b[0m',
  info: '\x1b[36mℹ\x1b[0m',
  header: '\x1b[1;36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function severityIcon(severity, ok) {
  if (ok) return ICONS.pass;
  if (severity === 'error') return ICONS.fail;
  if (severity === 'warning') return ICONS.warn;
  return ICONS.info;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { values } = parseArgs({
    options: {
      verbose: { type: 'boolean', default: false },
      rule: { type: 'string' },
      category: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });

  console.log(
    `\n${ICONS.header}╔══════════════════════════════════════════════════╗${ICONS.reset}`,
  );
  console.log(`${ICONS.header}║  Architecture Governance Validator v0.1          ║${ICONS.reset}`);
  console.log(
    `${ICONS.header}╚══════════════════════════════════════════════════╝${ICONS.reset}\n`,
  );
  console.log(`${ICONS.dim}Root: ${ARCH_ROOT}${ICONS.reset}\n`);

  // Build context
  const govFiles = findFiles(GOV_ROOT);
  const govDocs = govFiles.map(readFrontmatter);
  const modelContent = existsSync(MODEL_PATH) ? readFileSync(MODEL_PATH, 'utf-8') : '';
  const model = parseModel(modelContent);

  const ctx = { govDocs, model };

  console.log(
    `${ICONS.dim}Governance docs: ${govDocs.length}  |  Elements: ${model.elements.length}  |  Relations: ${model.relations.length}  |  Views: ${model.views.length}  |  Scopes: ${model.scopes.length}${ICONS.reset}\n`,
  );

  // Filter rules
  let ruleIds = Object.keys(validators);
  if (values.rule) {
    ruleIds = ruleIds.filter((id) => id === values.rule);
  }
  if (values.category) {
    ruleIds = ruleIds.filter((id) => ruleMeta[id]?.category === values.category);
  }

  // Run
  const summary = { pass: 0, fail: 0, warn: 0, total: 0 };
  const allResults = [];
  let currentCategory = null;

  // Sort by category
  ruleIds.sort(
    (a, b) =>
      (ruleMeta[a]?.category || '').localeCompare(ruleMeta[b]?.category || '') ||
      a.localeCompare(b),
  );

  for (const ruleId of ruleIds) {
    const meta = ruleMeta[ruleId] || {
      name: ruleId,
      category: 'unknown',
      severity: 'error',
    };

    // Category header
    if (meta.category !== currentCategory) {
      currentCategory = meta.category;
      console.log(
        `${ICONS.bold}── ${currentCategory} ${'─'.repeat(Math.max(0, 45 - currentCategory.length))}${ICONS.reset}`,
      );
    }

    const results = validators[ruleId](ctx);

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    summary.total += results.length;
    summary.pass += passed;
    if (meta.severity === 'error') {
      summary.fail += failed;
    } else {
      summary.warn += failed;
    }

    const ruleIcon = failed === 0 ? ICONS.pass : severityIcon(meta.severity, false);
    console.log(
      `  ${ruleIcon} ${ICONS.bold}${ruleId}${ICONS.reset} ${meta.name} ${ICONS.dim}(${passed}/${results.length})${ICONS.reset}`,
    );

    if (values.verbose || failed > 0) {
      for (const r of results) {
        if (!r.ok || values.verbose) {
          const icon = severityIcon(meta.severity, r.ok);
          console.log(`    ${icon} ${r.message}`);
        }
      }
    }

    allResults.push({ ruleId, meta, results });
  }

  // Summary
  console.log(`\n${ICONS.bold}── Summary ${'─'.repeat(40)}${ICONS.reset}`);
  console.log(
    `  ${ICONS.pass} Pass: ${summary.pass}    ${ICONS.fail} Fail: ${summary.fail}    ${ICONS.warn} Warn: ${summary.warn}    Total: ${summary.total}`,
  );
  console.log();

  // JSON output
  if (values.json) {
    const jsonOutput = allResults.map((r) => ({
      rule: r.ruleId,
      ...r.meta,
      checks: r.results,
    }));
    console.log(JSON.stringify(jsonOutput, null, 2));
  }

  // Exit code
  process.exit(summary.fail > 0 ? 1 : 0);
}

main();
