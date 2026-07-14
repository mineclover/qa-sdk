import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, validate, codegen, CodegenValidationError } from 'taxonomy-engine';
import { loadRegistryDir, extractRegistryDir, filterRegistryArgs } from './shared.js';

export function codegenCmd(args: string[]): void {
  const json = args.includes('--json');
  const skipValidate = args.includes('--skip-validate');
  const registryDir = extractRegistryDir(args);
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const filteredArgs = filterRegistryArgs(args);
  const positional = filteredArgs.filter((a, i) => {
    if (a.startsWith('--')) return false;
    if (i > 0 && filteredArgs[i - 1] === '--out') return false;
    return true;
  });
  const file = positional[0];

  if (!file) {
    console.error(
      '사용법: qa-sdk tax codegen <file> --out <dir> [--registry <dir>] [--skip-validate] [--json]',
    );
    process.exit(1);
    return;
  }
  if (!outDir) {
    console.error('--out <dir> 필수');
    process.exit(1);
    return;
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const parsed = parse(text);
  if ('error' in parsed) {
    console.error(`parse 실패: ${parsed.error.message}`);
    process.exit(1);
    return;
  }

  // registry가 있으면 cross-tax import 해소를 위해 validate 강화
  let reg;
  if (registryDir) {
    reg = loadRegistryDir(registryDir);
    reg.add(parsed.ir);
  }

  let result;
  try {
    // registry가 있으면 validate(errors only) 먼저 실행
    if (!skipValidate && reg) {
      const diags = validate(parsed.ir, reg);
      const errors = diags.filter((d) => d.severity === 'error');
      if (errors.length > 0) {
        throw new CodegenValidationError(errors);
      }
    }
    result = codegen(parsed.ir, { skipValidate });
  } catch (e) {
    if (e instanceof CodegenValidationError) {
      console.error(`codegen 거부: ${e.diagnostics.length} errors`);
      for (const d of e.diagnostics) {
        console.error(`  ERR ${d.code}: ${d.message}`);
      }
      console.error('--skip-validate로 우회 가능');
      process.exit(1);
      return;
    }
    throw e;
  }

  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const [name, content] of Object.entries(result.files)) {
    const path = join(outDir, name);
    writeFileSync(path, content);
    written.push(path);
  }

  if (json) {
    console.log(JSON.stringify({ contentHash: result.contentHash, files: written }, null, 2));
    return;
  }

  console.log(`✔ codegen 완료 (contentHash: ${result.contentHash})`);
  for (const path of written) {
    console.log(`  ${path}`);
  }
}
