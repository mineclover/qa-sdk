import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse as parseYaml } from 'taxonomy-engine';
import {
  extractEvidence,
  parseDecisionFile,
  resolveDecisionLink,
  toFlowSchema,
  toMarkdownText,
  type DecisionFile,
} from 'taxonomy-decision-bridge';

const TAX_DIR = 'docs/taxonomies';
const DECISIONS_DIR = 'docs/decisions';

type RenderArgs = {
  refFilter?: string;
  outPath?: string;
};

export async function decisionRenderCmd(args: string[]): Promise<void> {
  const parsed = parseRenderArgs(args);
  if ('error' in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return;
  }

  const cwd = process.cwd();
  let yamlFiles: string[];
  try {
    yamlFiles = readdirSync(join(cwd, TAX_DIR))
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => join(TAX_DIR, f));
  } catch (e) {
    console.error(`docs/taxonomies/ 읽기 실패: ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const rendered: Array<{ ref: string; text: string }> = [];

  for (const yamlFile of yamlFiles) {
    const text = readFileSync(join(cwd, yamlFile), 'utf8');
    const r = parseYaml(text);
    if ('error' in r) continue;
    for (const [axisName, axis] of r.ir.axes) {
      for (const entry of axis.entries) {
        if (!entry.decisionLink) continue;
        const subject = `tax:${r.ir.taxonomy}:${axisName}.${entry.id}`;
        if (parsed.refFilter && parsed.refFilter !== subject) continue;
        const resolved = resolveDecisionLink({
          link: entry.decisionLink,
          yamlAbsDir: dirname(join(cwd, yamlFile)),
          decisionsDir: join(cwd, DECISIONS_DIR),
        });
        if (resolved.kind === 'external' || resolved.kind === 'unsupported') continue;
        const decisionPath = resolved.absPath;
        if (!existsSync(decisionPath)) continue;
        let decisionFile: DecisionFile;
        try {
          decisionFile = parseDecisionFile(readFileSync(decisionPath, 'utf8'));
        } catch {
          continue;
        }
        const schema = toFlowSchema(decisionFile, {
          sourcePath: relative(cwd, decisionPath),
        });
        const evidence = extractEvidence(decisionFile, {
          sourcePath: relative(cwd, decisionPath),
        });
        const renderedText = toMarkdownText({
          schema,
          lifecycle: decisionFile.meta.lifecycle,
          evidence,
          outcome: decisionFile.markers.outcome,
          created: decisionFile.meta.created,
          updated: decisionFile.meta.updated,
        });
        rendered.push({ ref: subject, text: renderedText });
      }
    }
  }

  if (rendered.length === 0) {
    console.error('render 대상 decision 없음');
    process.exit(1);
    return;
  }

  if (parsed.outPath) {
    // 단일 ref 필터 시 outPath = 단일 파일 path
    if (rendered.length !== 1) {
      console.error(
        `--out 사용 시 단일 ref만 지원 (현재 ${rendered.length}건). <ref> 인자로 좁히세요.`,
      );
      process.exit(1);
      return;
    }
    const abs = join(cwd, parsed.outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, rendered[0].text);
    console.log(`✔ ${rendered[0].ref} → ${parsed.outPath}`);
    return;
  }

  // stdout
  for (const r of rendered) {
    if (rendered.length > 1) console.log(`\n=== ${r.ref} ===\n`);
    console.log(r.text);
  }
}

function parseRenderArgs(args: string[]): RenderArgs | { error: string } {
  const opts: RenderArgs = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') {
      const next = args[i + 1];
      if (!next) return { error: '--out: path 인자 필요' };
      opts.outPath = next;
      i++;
    } else if (!a.startsWith('--')) {
      opts.refFilter = a;
    } else {
      return { error: `알 수 없는 옵션: ${a}` };
    }
  }
  return opts;
}
