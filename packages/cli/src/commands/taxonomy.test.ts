import { describe, it, expect, vi } from 'vitest';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { cliTaxonomy } from './taxonomy/index.js';
import { randomBytes } from 'node:crypto';

const GOOD_YAML = `
taxonomy: ok
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 4
`;

const BAD_YAML = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b, c, d]
    capacity: 4
`;

const SHOW_YAML = `
taxonomy: tx
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 4
`;

function writeTmp(name: string, content: string): string {
  const dir = join(tmpdir(), `tax-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe('cli tax validate', () => {
  it('OK yaml → exit 0', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['validate', writeTmp('good.yaml', GOOD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('warning yaml → exit 0 (warning은 통과)', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['validate', writeTmp('warn.yaml', BAD_YAML)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('--strict 시 warning을 error로 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['validate', '--strict', writeTmp('strict.yaml', BAD_YAML)]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('--lifecycle-strict 시 lifecycle 누락 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['validate', '--lifecycle-strict', writeTmp('lc.yaml', GOOD_YAML)]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('lifecycle 모두 부여된 yaml + --lifecycle-strict → exit 0', async () => {
    const yaml = `
taxonomy: lcok
version: 1
axes:
  scope:
    lifecycle: approved
    entries:
      - { id: a, address: 0, lifecycle: approved }
      - { id: b, address: 1, lifecycle: approved }
`;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['validate', '--lifecycle-strict', writeTmp('lcok.yaml', yaml)]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax show', () => {
  it('entry 조회 → exit 0 + 정보 출력', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const file = writeTmp('show.yaml', SHOW_YAML);
    await cliTaxonomy(['show', file, 'tx:scope.a']);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    exit.mockRestore();
  });

  it('해소 실패 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = writeTmp('show.yaml', SHOW_YAML);
    await cliTaxonomy(['show', file, 'tx:scope.missing']);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });

  it('entry lifecycle/placeholderReason 출력에 포함', async () => {
    const yaml = `
taxonomy: lc
version: 1
axes:
  s:
    lifecycle: approved
    entries:
      - { id: pending, address: 0, lifecycle: tbd, placeholderReason: "결정 대기" }
`;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const file = writeTmp('lcshow.yaml', yaml);
    await cliTaxonomy(['show', file, 'lc:s.pending']);
    expect(exit).not.toHaveBeenCalledWith(1);
    const lines = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(lines).toMatch(/lifecycle:\s*tbd/);
    expect(lines).toMatch(/reason:\s*결정 대기/);
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax codegen', () => {
  it('정상 yaml → 5 파일 생성', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const file = writeTmp('ok.yaml', GOOD_YAML);
    const outDir = join(tmpdir(), `tax-cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await cliTaxonomy(['codegen', file, '--out', outDir]);

    expect(exit).not.toHaveBeenCalledWith(1);
    expect(existsSync(join(outDir, 'axes.ts'))).toBe(true);
    expect(existsSync(join(outDir, 'addresses.ts'))).toBe(true);
    expect(existsSync(join(outDir, 'registry.ts'))).toBe(true);
    expect(existsSync(join(outDir, 'relations.ts'))).toBe(true);
    expect(existsSync(join(outDir, 'meta.ts'))).toBe(true);

    rmSync(outDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it('--out 누락 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = writeTmp('ok.yaml', GOOD_YAML);
    await cliTaxonomy(['codegen', file]);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });

  it('broken IR + --skip-validate → 생성 성공', async () => {
    const brokenYaml = `
taxonomy: bad
version: 1
axes:
  scope:
    entries: [a, b]
    capacity: 2
relations:
  r:
    from: scope
    to: scope
    kind: contains
    rules:
      - { upper: a, lower: missing }
`;
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const file = writeTmp('bad.yaml', brokenYaml);
    const outDir = join(
      tmpdir(),
      `tax-cg-skip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    await cliTaxonomy(['codegen', file, '--out', outDir, '--skip-validate']);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(existsSync(join(outDir, 'axes.ts'))).toBe(true);

    rmSync(outDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });

  it('codegen + --registry — cross-tax import 해소 후 codegen 성공', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const regDir = join(tmpdir(), `tax-cg-reg-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(regDir, { recursive: true });
    writeFileSync(
      join(regDir, 'base.yaml'),
      `taxonomy: base
version: 1
axes:
  a:
    entries: [x]
    capacity: 2
`,
    );
    const derFile = join(regDir, 'der.yaml');
    writeFileSync(
      derFile,
      `taxonomy: der
version: 1
imports:
  - { taxonomy: base, version: 1, as: b }
axes:
  s:
    entries: [y]
    capacity: 2
`,
    );
    const outDir = join(tmpdir(), `tax-cg-out-${Date.now()}-${randomBytes(4).toString('hex')}`);

    await cliTaxonomy(['codegen', derFile, '--out', outDir, '--registry', regDir]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(existsSync(join(outDir, 'axes.ts'))).toBe(true);

    rmSync(regDir, { recursive: true });
    rmSync(outDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax diff', () => {
  it('같은 yaml → 동일 메시지 + exit 0', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const file = writeTmp('a.yaml', GOOD_YAML);
    await cliTaxonomy(['diff', file, file]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('동일'));
    log.mockRestore();
    exit.mockRestore();
  });

  it('다른 yaml → 변경 목록 출력', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fileA = writeTmp('a.yaml', GOOD_YAML);
    const fileB = writeTmp('b.yaml', GOOD_YAML.replace('[a, b]', '[a, b, c]'));
    await cliTaxonomy(['diff', fileA, fileB]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    exit.mockRestore();
  });

  it('diff --semver: major 변경 → exit 1 + breakingLevel 출력', async () => {
    const a = writeTmp('a.yaml', GOOD_YAML);
    const b = writeTmp('b.yaml', GOOD_YAML.replace('[a, b]', '[a]'));
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['diff', a, b, '--semver']);
    expect(exit).toHaveBeenCalledWith(1);
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toMatch(/breakingLevel:\s*major/);
    log.mockRestore();
    exit.mockRestore();
  });

  it('diff --semver: 변경 없음 → exit 0 + breakingLevel none', async () => {
    const f = writeTmp('a.yaml', GOOD_YAML);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['diff', f, f, '--semver']);
    expect(exit).not.toHaveBeenCalledWith(1);
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toMatch(/breakingLevel:\s*none/);
    log.mockRestore();
    exit.mockRestore();
  });

  it('diff --semver: minor 변경 → exit 0', async () => {
    const a = writeTmp('a.yaml', GOOD_YAML);
    const b = writeTmp('b.yaml', GOOD_YAML.replace('[a, b]', '[a, b, c]'));
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['diff', a, b, '--semver']);
    expect(exit).not.toHaveBeenCalledWith(1);
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toMatch(/breakingLevel:\s*minor/);
    log.mockRestore();
    exit.mockRestore();
  });

  it('diff + --registry — validate 진단 함께 출력', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const regDir = join(tmpdir(), `tax-diff-reg-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(regDir, { recursive: true });
    const fileA = join(regDir, 'a.yaml');
    const fileB = join(regDir, 'b.yaml');
    writeFileSync(
      fileA,
      `taxonomy: a
version: 1
axes:
  s:
    entries: [x]
    capacity: 2
`,
    );
    writeFileSync(
      fileB,
      `taxonomy: b
version: 1
axes:
  s:
    entries: [x, y]
    capacity: 4
`,
    );

    await cliTaxonomy(['diff', fileA, fileB, '--registry', regDir]);
    expect(exit).not.toHaveBeenCalledWith(1);
    // validate 메시지 출력 확인
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[--registry'));

    rmSync(regDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax --registry <dir>', () => {
  it('validate — registry에 base taxonomy 있으면 cross-tax import 통과', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const regDir = join(tmpdir(), `tax-reg-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(regDir, { recursive: true });

    // base
    writeFileSync(
      join(regDir, 'base.yaml'),
      `taxonomy: base
version: 1
axes:
  a:
    entries: [x]
    capacity: 2
`,
    );
    // derived (imports base)
    const derivedFile = join(regDir, 'der.yaml');
    writeFileSync(
      derivedFile,
      `taxonomy: der
version: 1
imports:
  - { taxonomy: base, version: 1, as: b }
axes:
  s:
    entries: [y]
    capacity: 2
`,
    );

    await cliTaxonomy(['validate', derivedFile, '--registry', regDir]);
    expect(exit).not.toHaveBeenCalledWith(1);

    rmSync(regDir, { recursive: true });
    log.mockRestore();
    err.mockRestore();
    exit.mockRestore();
  });

  it('show — registry-wide 조회 (file 없이 ref만)', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const regDir = join(tmpdir(), `tax-reg-show-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(regDir, { recursive: true });
    writeFileSync(
      join(regDir, 'x.yaml'),
      `taxonomy: x
version: 1
axes:
  s:
    entries: [aa, bb]
    capacity: 4
`,
    );

    await cliTaxonomy(['show', 'x:s.aa', '--registry', regDir]);
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalled();

    rmSync(regDir, { recursive: true });
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax git-diff', () => {
  it('base=HEAD → 변경 없음 메시지 + exit 0', async () => {
    // git 사용 가능한지 확인
    try {
      execSync('git rev-parse HEAD', { stdio: 'ignore' });
    } catch {
      // git 없거나 repo 아니면 skip
      return;
    }
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await cliTaxonomy(['git-diff', 'HEAD']);
    expect(exit).not.toHaveBeenCalledWith(1);
    // "변경 없음" 또는 변경 메시지 기대
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    exit.mockRestore();
  });
});

describe('cli tax migration', () => {
  it('--base HEAD vs working tree — 명령 정상 실행 (git 없으면 skip)', async () => {
    let repoRoot: string;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
      }).trim();
    } catch {
      return;
    }
    const relPath = 'docs/taxonomies/qa-sdk-coordinate-system.yaml';
    const prevCwd = process.cwd();
    process.chdir(repoRoot);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await cliTaxonomy(['migration', '--base', 'HEAD', relPath]);
      expect(exit).not.toHaveBeenCalledWith(1);
    } finally {
      process.chdir(prevCwd);
      log.mockRestore();
      err.mockRestore();
      exit.mockRestore();
    }
  });

  it('file 누락 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await cliTaxonomy(['migration', '--base', 'main']);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });

  it('decisionImpact: lifecycle 변경된 entry → 출력에 표시', async () => {
    // tmp git repo 구성: base commit에 yaml 추가, 그 다음 lifecycle 변경
    const dir = join(tmpdir(), `tax-mig-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(join(dir, 'docs/taxonomies'), { recursive: true });
    const yamlPath = join(dir, 'docs/taxonomies/t.yaml');
    const baseYaml = `taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: tbd, decisionLink: "decision:t.layer.cue" }
`;
    const headYaml = `taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: approved, decisionLink: "decision:t.layer.cue" }
`;
    writeFileSync(yamlPath, baseYaml);
    execSync('git init -q', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "test"', { cwd: dir });
    execSync('git add -A && git commit -q -m base', { cwd: dir });
    writeFileSync(yamlPath, headYaml);

    const prevCwd = process.cwd();
    process.chdir(dir);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await cliTaxonomy(['migration', '--base', 'HEAD', 'docs/taxonomies/t.yaml']);
      const out = log.mock.calls.map((c) => String(c[0])).join('\n');
      expect(out).toMatch(/decision impact/);
      expect(out).toMatch(/id=cue/);
      expect(out).toMatch(/lifecycle-changed/);
      expect(out).toMatch(/decision:t\.layer\.cue/);
      expect(out).toMatch(/tbd → approved/);
      expect(exit).not.toHaveBeenCalledWith(1);
    } finally {
      process.chdir(prevCwd);
      rmSync(dir, { recursive: true, force: true });
      log.mockRestore();
      err.mockRestore();
      exit.mockRestore();
    }
  });

  it('decisionImpact: --json 출력에 포함', async () => {
    const dir = join(tmpdir(), `tax-mig-${Date.now()}-${randomBytes(4).toString('hex')}`);
    mkdirSync(join(dir, 'docs/taxonomies'), { recursive: true });
    const yamlPath = join(dir, 'docs/taxonomies/t.yaml');
    const baseYaml = `taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: cue, address: 0, lifecycle: approved, decisionLink: "decision:t.layer.cue" }
      - { id: stage, address: 1, lifecycle: approved }
`;
    const headYaml = `taxonomy: t
version: 1
axes:
  layer:
    lifecycle: approved
    entries:
      - { id: stage, address: 1, lifecycle: approved }
`;
    writeFileSync(yamlPath, baseYaml);
    execSync('git init -q', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "test"', { cwd: dir });
    execSync('git add -A && git commit -q -m base', { cwd: dir });
    writeFileSync(yamlPath, headYaml);

    const prevCwd = process.cwd();
    process.chdir(dir);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await cliTaxonomy(['migration', '--base', 'HEAD', 'docs/taxonomies/t.yaml', '--json']);
      const out = log.mock.calls.map((c) => String(c[0])).join('\n');
      const parsed = JSON.parse(out);
      expect(parsed.plan.decisionImpact).toEqual([
        {
          axis: 'layer',
          id: 'cue',
          decisionLink: 'decision:t.layer.cue',
          impact: 'removed',
        },
      ]);
    } finally {
      process.chdir(prevCwd);
      rmSync(dir, { recursive: true, force: true });
      log.mockRestore();
      err.mockRestore();
      exit.mockRestore();
    }
  });
});

describe('cli tax doctor', () => {
  it('--expected fixture와 매칭 → exit 0', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const yamlFile = writeTmp(
      'ok.yaml',
      `taxonomy: ok
version: 1
axes:
  s:
    entries: [a, b]
    capacity: 4
`,
    );
    const expectedFile = writeTmp(
      'expected.json',
      JSON.stringify({
        taxonomy: 'ok',
        axes: { s: { entries: [{ id: 'a' }, { id: 'b' }] } },
      }),
    );
    await cliTaxonomy(['doctor', yamlFile, '--expected', expectedFile]);
    expect(exit).not.toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('--expected drift 발생 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const yamlFile = writeTmp(
      'drift.yaml',
      `taxonomy: ok
version: 1
axes:
  s:
    entries: [a]
    capacity: 4
`,
    );
    const expectedFile = writeTmp(
      'expected.json',
      JSON.stringify({
        taxonomy: 'ok',
        axes: { s: { entries: [{ id: 'a' }, { id: 'missing' }] } },
      }),
    );
    await cliTaxonomy(['doctor', yamlFile, '--expected', expectedFile]);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
    exit.mockRestore();
  });

  it('--auto 지원 없는 파일명 → exit 1', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const yamlFile = writeTmp(
      'unknown-name.yaml',
      `taxonomy: ok
version: 1
axes:
  s:
    entries: [a]
    capacity: 2
`,
    );
    await cliTaxonomy(['doctor', yamlFile, '--auto']);
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('--auto 지원 매핑 없음'));
    err.mockRestore();
    exit.mockRestore();
  });
});
