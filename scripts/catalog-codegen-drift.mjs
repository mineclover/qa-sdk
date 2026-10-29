#!/usr/bin/env node
/**
 * catalog codegen drift 검사 — 생성기를 다시 실행해 커밋된 생성물과 바이트 비교한다.
 *
 * 해시 lockfile을 두지 않는다: 생성기 출력 자체가 결정론적(시각·locale 무관)이므로
 * "지금 다시 만들면 같은 바이트인가"가 곧 drift 판정이다.
 *
 * 대상:
 *   demo-types      — `qa-sdk codegen` 출력 → oxfmt(.oxfmtrc.json) 정규화 → packages/demo-types/src
 *   browser-catalog — viz-3d 생성기 출력 (compact 원문 유지) → packages/browser-codec/src/demo-catalog-browser.ts
 *
 * Usage:
 *   node scripts/catalog-codegen-drift.mjs            # 검사 (drift → exit 1)
 *   node scripts/catalog-codegen-drift.mjs --update   # 재생성 결과로 커밋 대상 갱신
 *
 * 전제: packages/cli/dist (codegen-core·core 포함) 빌드 완료.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE = process.argv.includes('--update');

/** codegen-core가 모든 생성 파일 헤더에 쓰는 표식 — 출력에서 사라진 생성 파일(stale) 탐지용 */
const GENERATED_MARKER = '// !! 자동 생성 파일 — 직접 수정 금지 !!';

const CLI_ENTRY = join(repoRoot, 'packages/cli/dist/index.js');
const DEMO_TYPES_DIR = join(repoRoot, 'packages/demo-types');
const VIZ_3D_DIR = join(repoRoot, 'packages/viz-3d');
const BROWSER_CATALOG_PATH = join(repoRoot, 'packages/browser-codec/src/demo-catalog-browser.ts');

/** 하위 프로세스 실행 — 실패 시 stderr를 그대로 보여주고 exit 2 */
function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    console.error(`✖ 실행 실패: ${command} ${args.join(' ')}`);
    if (result.error) console.error(result.error.message);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(2);
  }
  return result.stdout;
}

/** 패키지 bin 스크립트 절대 경로 (해당 패키지 기준 resolve) */
function resolveBin(fromDir, pkgName, binName) {
  const require = createRequire(join(fromDir, 'package.json'));
  const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
  const { bin } = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const rel = typeof bin === 'string' ? bin : bin[binName];
  return join(dirname(pkgJsonPath), rel);
}

/** repo .oxfmtrc.json 기준 포맷 — targetPath의 확장자·위치로 파서와 설정을 결정 */
function formatWithOxfmt(content, targetPath) {
  const oxfmt = resolveBin(repoRoot, 'oxfmt', 'oxfmt');
  return run(process.execPath, [oxfmt, `--stdin-filepath=${relative(repoRoot, targetPath)}`], {
    cwd: repoRoot,
    input: content,
  });
}

/**
 * 각 target은 tmp 디렉토리에 생성 후 [{ target, content }] (커밋 대상 절대 경로 + 기대 바이트)를 반환한다.
 * staleDir: 출력 목록에 없는데 GENERATED_MARKER를 가진 파일을 stale로 판정할 디렉토리.
 */
const TARGETS = [
  {
    name: 'demo-types',
    staleDir: join(DEMO_TYPES_DIR, 'src'),
    generate(tmp) {
      if (!existsSync(CLI_ENTRY)) {
        console.error(`✖ ${relative(repoRoot, CLI_ENTRY)} 없음 — @qa-sdk/cli를 먼저 빌드하세요`);
        process.exit(2);
      }
      const outDir = join(tmp, 'demo-types');
      // demo-types `generate` 스크립트와 같은 cwd — config 탐색(qa-sdk.config.*)이 cwd 기준
      run(process.execPath, [CLI_ENTRY, 'codegen', '--output', outDir], { cwd: DEMO_TYPES_DIR });
      return readdirSync(outDir)
        .toSorted()
        .map((file) => {
          const target = join(DEMO_TYPES_DIR, 'src', file);
          return {
            target,
            content: formatWithOxfmt(readFileSync(join(outDir, file), 'utf8'), target),
          };
        });
    },
  },
  {
    name: 'browser-catalog',
    staleDir: undefined,
    generate(tmp) {
      const out = join(tmp, 'demo-catalog-browser.ts');
      const tsx = resolveBin(VIZ_3D_DIR, 'tsx', 'tsx');
      run(process.execPath, [tsx, 'scripts/generate-browser-catalog.ts', '--out', out], {
        cwd: VIZ_3D_DIR,
      });
      return [{ target: BROWSER_CATALOG_PATH, content: readFileSync(out, 'utf8') }];
    },
  },
];

/** 첫 번째로 다른 줄 번호 (1-based) */
function firstDiffLine(expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return i + 1;
  }
  return 0;
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'catalog-codegen-drift-'));
  const drifted = [];
  try {
    for (const t of TARGETS) {
      const outputs = t.generate(tmp);
      const produced = new Set(outputs.map((o) => o.target));

      for (const { target, content } of outputs) {
        const rel = relative(repoRoot, target);
        const current = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
        if (current === content) continue;
        drifted.push(
          current === undefined
            ? `${rel} (누락)`
            : `${rel} (line ${firstDiffLine(content, current)}부터 다름)`,
        );
        if (UPDATE) writeFileSync(target, content);
      }

      if (t.staleDir) {
        for (const file of readdirSync(t.staleDir).toSorted()) {
          const path = join(t.staleDir, file);
          if (produced.has(path) || !file.endsWith('.ts')) continue;
          if (!readFileSync(path, 'utf8').includes(GENERATED_MARKER)) continue;
          drifted.push(`${relative(repoRoot, path)} (생성기 출력에 없는 stale 생성 파일)`);
          if (UPDATE) unlinkSync(path);
        }
      }
      console.log(`✔ ${t.name}: ${outputs.length} file(s) 재생성`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (drifted.length === 0) {
    console.log('\n✔ codegen drift 없음 — 커밋된 생성물이 source와 일치');
    return;
  }

  if (UPDATE) {
    console.log(`\n✔ ${drifted.length}개 생성물 갱신:`);
    for (const d of drifted) console.log(`  - ${d}`);
    return;
  }

  console.error(`\n✖ ${drifted.length}개 생성물이 source와 다름:`);
  for (const d of drifted) console.error(`  - ${d}`);
  console.error('\n생성물은 직접 수정하지 않는다. `pnpm codegen:update`로 재생성 후 커밋하세요.');
  process.exit(1);
}

main();
