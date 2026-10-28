import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = join(dirname(fileURLToPath(import.meta.url)), 'sync-skills.sh');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'qa-skill-sync-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const home = join(root, 'home');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(home);
  cpSync(script, join(repo, 'scripts/sync-skills.sh'));
  writeFileSync(join(repo, 'scripts/project-skills.txt'), '# project defaults\ncore\n');
  function put(path, content = path) {
    const file = join(repo, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  put('skills/core/SKILL.md', 'core source');
  put('skills/core/references/rule.md', 'bundled rule');
  put('skills/extra/SKILL.md', 'extra source');
  function run(...args) {
    return spawnSync('bash', [join(repo, 'scripts/sync-skills.sh'), ...args], {
      encoding: 'utf8',
      env: { ...process.env, HOME: home, CODEX_HOME: join(home, '.codex') },
    });
  }
  return { repo, home, put, run };
}

test('default sync is project-only, preserves resources and foreign skills, archives old copies', (t) => {
  const { repo, home, put, run } = fixture(t);
  put('.agents/skills/core/SKILL.md', 'local customization');
  put('.agents/skills/extra/SKILL.md', 'extra runtime');
  put('.agents/skills/foreign/SKILL.md', 'foreign runtime');
  assert.equal(run().status, 0);
  assert.deepEqual(readdirSync(home), []);
  for (const target of ['.agents/skills', '.claude/skills']) {
    assert.equal(readFileSync(join(repo, target, 'core/SKILL.md'), 'utf8'), 'core source');
    assert.equal(
      readFileSync(join(repo, target, 'core/references/rule.md'), 'utf8'),
      'bundled rule',
    );
    assert.equal(existsSync(join(repo, target, 'extra')), false);
  }
  assert.equal(existsSync(join(repo, 'skills/extra/SKILL.md')), true);
  assert.equal(existsSync(join(repo, '.agents/skills/foreign/SKILL.md')), true);
  const backup = join(
    repo,
    '.skill-sync-backups',
    readdirSync(join(repo, '.skill-sync-backups'))[0],
  );
  assert.equal(
    readFileSync(join(backup, '.agents/skills/core/SKILL.md'), 'utf8'),
    'local customization',
  );
  assert.equal(
    readFileSync(join(backup, '.agents/skills/extra/SKILL.md'), 'utf8'),
    'extra runtime',
  );
  assert.equal(run().status, 0);
  assert.equal(readdirSync(join(repo, '.skill-sync-backups')).length, 1);
});

test('dry-run creates no roots or backup; explicit task selection is reset by default sync', (t) => {
  const { repo, home, run } = fixture(t);
  assert.equal(run('--dry-run').status, 0);
  assert.equal(existsSync(join(repo, '.agents')), false);
  assert.equal(existsSync(join(repo, '.claude')), false);
  assert.equal(existsSync(join(repo, '.skill-sync-backups')), false);
  assert.equal(run('--target', 'codex', '--skill', 'extra').status, 0);
  assert.equal(existsSync(join(repo, '.agents/skills/extra/SKILL.md')), true);
  assert.equal(existsSync(join(repo, '.claude')), false);
  assert.equal(run('--target', 'antigravity').status, 0);
  assert.equal(existsSync(join(repo, '.agents/skills/extra')), false);
  assert.deepEqual(readdirSync(home), []);
});

test('missing sources and symlinked discovery or backup roots fail before writes', (t) => {
  const { repo, home, run } = fixture(t);
  assert.notEqual(run('--skill', 'missing').status, 0);
  assert.notEqual(run('--global').status, 0);
  assert.equal(existsSync(join(repo, '.agents')), false);
  symlinkSync(home, join(repo, '.agents'));
  assert.notEqual(run().status, 0);
  assert.deepEqual(readdirSync(home), []);
  assert.equal(existsSync(join(repo, '.claude')), false);
  rmSync(join(repo, '.agents'));
  symlinkSync(home, join(repo, '.skill-sync-backups'));
  assert.notEqual(run().status, 0);
  assert.deepEqual(readdirSync(home), []);
});
