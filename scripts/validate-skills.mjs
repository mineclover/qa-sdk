#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = join(repoRoot, 'skills');
const allowedFrontmatterKeys = new Set([
  'name',
  'description',
  'metadata',
  'license',
  'allowed-tools',
]);

function parseFrontmatter(file, text) {
  const errors = [];
  if (!text.startsWith('---\n')) {
    errors.push(`${file}: frontmatter must start with ---`);
    return { errors, end: 0 };
  }

  const closing = text.indexOf('\n---', 4);
  if (closing < 0) {
    errors.push(`${file}: frontmatter closing --- is missing`);
    return { errors, end: 0 };
  }

  const frontmatter = text.slice(4, closing);
  const keys = [...frontmatter.matchAll(/^([A-Za-z0-9_-]+):/gm)].map((match) => match[1]);
  for (const key of new Set(keys)) {
    if (!allowedFrontmatterKeys.has(key)) {
      errors.push(`${file}: unsupported frontmatter key '${key}'`);
    }
  }

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.*)$/m);
  if (!nameMatch || !nameMatch[1].trim()) {
    errors.push(`${file}: name is required`);
  }
  if (!descriptionMatch || !descriptionMatch[1].trim()) {
    errors.push(`${file}: description is required`);
  }

  return {
    errors,
    end: closing + 4,
    name: nameMatch?.[1].trim().replace(/^['"]|['"]$/g, ''),
  };
}

function checkLocalLinks(file, text) {
  const errors = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split('#', 1)[0];
    if (!target || /^(?:[a-z]+:|\/|#)/i.test(target) || /[<>]/.test(target)) {
      continue;
    }
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) {
      errors.push(`${file}: missing local link '${target}'`);
    }
  }
  return errors;
}

if (!existsSync(skillsRoot) || !statSync(skillsRoot).isDirectory()) {
  console.error(`skills directory missing: ${skillsRoot}`);
  process.exit(1);
}

const errors = [];
const names = new Map();
const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const dir of skillDirs) {
  const file = join(skillsRoot, dir, 'SKILL.md');
  if (!existsSync(file)) {
    errors.push(`${join(skillsRoot, dir)}: SKILL.md is missing`);
    continue;
  }

  const text = readFileSync(file, 'utf8');
  const parsed = parseFrontmatter(file, text);
  errors.push(...parsed.errors);
  if (parsed.name && parsed.name !== dir) {
    errors.push(`${file}: name '${parsed.name}' does not match directory '${dir}'`);
  }
  if (parsed.name) {
    const previous = names.get(parsed.name);
    if (previous) {
      errors.push(`${file}: duplicate skill name '${parsed.name}' also used by ${previous}`);
    } else {
      names.set(parsed.name, file);
    }
  }

  const bodyLineCount = text.slice(parsed.end).split(/\r?\n/).length - 1;
  if (bodyLineCount > 500) {
    errors.push(
      `${file}: body is ${bodyLineCount} lines; split bundled references before exceeding 500`,
    );
  }
  errors.push(...checkLocalLinks(file, text));
}

if (errors.length > 0) {
  console.error(`skills:check failed (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const resourceCount = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) => {
    const root = join(skillsRoot, dir.name);
    const pending = [root];
    let count = 0;
    while (pending.length) {
      const current = pending.pop();
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) pending.push(join(current, entry.name));
        else count += 1;
      }
    }
    return [count];
  })
  .reduce((sum, count) => sum + count, 0);

console.log(`skills:check passed (${skillDirs.length} skills, ${resourceCount} files)`);
