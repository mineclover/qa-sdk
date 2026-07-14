// @def.boundary scaffold-architecture-validator
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface ScenarioValidationIssue {
  readonly ruleId: string;
  readonly path: string;
  readonly message: string;
}

export interface ScenarioValidationResult {
  readonly ok: boolean;
  readonly files: readonly string[];
  readonly issues: readonly ScenarioValidationIssue[];
}

export async function validateScenarios(
  root: string,
  repoRoot = process.cwd(),
): Promise<ScenarioValidationResult> {
  const files = await readScenarioFiles(root, repoRoot);
  const traceRoot = inferTraceRoot(root, repoRoot);
  const issues: ScenarioValidationIssue[] = [];

  for (const file of files) {
    const content = await readFile(join(repoRoot, file), 'utf8');
    issues.push(...(await validateScenarioFile(file, content, traceRoot)));
  }

  return {
    ok: issues.length === 0,
    files,
    issues,
  };
}

function inferTraceRoot(root: string, repoRoot: string): string {
  const normalized = root.replace(/\\/g, '/');
  const marker = '/docs/scenarios';
  if (normalized.endsWith(marker)) {
    return join(repoRoot, normalized.slice(0, -marker.length));
  }
  if (normalized === 'docs/scenarios') {
    return repoRoot;
  }
  return repoRoot;
}

async function validateScenarioFile(
  path: string,
  content: string,
  repoRoot: string,
): Promise<ScenarioValidationIssue[]> {
  const issues: ScenarioValidationIssue[] = [];
  for (const section of ['## Purpose', '## Traceability', '## Given', '## When', '## Then']) {
    if (!content.includes(section)) {
      issues.push(
        createIssue('scenario-has-required-sections', path, `Scenario must include ${section}.`),
      );
    }
  }

  const traceability = sectionContent(content, 'Traceability');
  if (!traceability) return issues;

  const useCases = bulletSection(traceability, 'Use cases');
  const tests = bulletSection(traceability, 'Tests');
  const contracts = bulletSection(traceability, 'Contracts');

  if (useCases.length === 0) {
    issues.push(
      createIssue(
        'scenario-traces-use-cases',
        path,
        'Traceability must include at least one use case.',
      ),
    );
  }
  if (tests.length === 0) {
    issues.push(
      createIssue(
        'scenario-traces-tests',
        path,
        'Traceability must include at least one test file.',
      ),
    );
  }
  if (contracts.length === 0) {
    issues.push(
      createIssue(
        'scenario-traces-contracts',
        path,
        'Traceability must include at least one contract file.',
      ),
    );
  }

  for (const entry of [...useCases, ...tests, ...contracts]) {
    const filePath = entry.split('#')[0] ?? entry;
    if (!(await fileExists(repoRoot, filePath))) {
      issues.push(
        createIssue(
          'scenario-trace-target-exists',
          path,
          `Traceability target does not exist: ${filePath}`,
        ),
      );
    }
  }

  return issues;
}

async function readScenarioFiles(root: string, repoRoot: string): Promise<string[]> {
  const absoluteRoot = join(repoRoot, root);
  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readScenarioFiles(child, repoRoot)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(child.replace(/\\/g, '/'));
    }
  }

  return files.toSorted();
}

function sectionContent(content: string, title: string): string | null {
  const pattern = new RegExp(`^## ${escapeRegExp(title)}\\s*$`, 'm');
  const match = pattern.exec(content);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const next = content.slice(start).search(/^## /m);
  return next >= 0 ? content.slice(start, start + next) : content.slice(start);
}

function bulletSection(content: string, title: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(title)}:\\s*$`, 'm');
  const match = pattern.exec(content);
  if (!match || match.index === undefined) return [];
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextLabel = rest.search(/^[A-Z][A-Za-z ]+:\s*$/m);
  const block = nextLabel >= 0 ? rest.slice(0, nextLabel) : rest;

  return [...block.matchAll(/^- `([^`]+)`/gm)].map((entry) => entry[1]).filter(Boolean);
}

async function fileExists(repoRoot: string, path: string): Promise<boolean> {
  return Boolean(await stat(join(repoRoot, path)).catch(() => null));
}

function createIssue(ruleId: string, path: string, message: string): ScenarioValidationIssue {
  return { ruleId, path, message };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
