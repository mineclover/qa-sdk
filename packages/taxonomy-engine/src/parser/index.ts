import {
  parse as parseYaml,
  parseDocument,
  LineCounter,
  isMap,
  isSeq,
  isScalar,
  YAMLParseError,
} from 'yaml';
import { createHash } from 'node:crypto';
import { TaxonomyDocSchema, type TaxonomyDoc } from '../schema/zod.js';
import type { TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR } from '../schema/ir.js';
import type { Diagnostic } from '../schema/diagnostic.js';

export type ParseError = Diagnostic;

export type ParseResult = { ir: TaxonomyIR } | { error: ParseError };

export function parse(yamlText: string): ParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (e) {
    let location: { line: number; column: number } | undefined;
    if (e instanceof YAMLParseError && e.linePos) {
      const linePos = Array.isArray(e.linePos) ? e.linePos[0] : e.linePos;
      location = { line: linePos.line, column: linePos.col };
    }
    return {
      error: {
        severity: 'error',
        code: 'parse-yaml-syntax',
        message: `YAML 문법 오류: ${(e as Error).message}`,
        location,
      },
    };
  }

  const parsed = TaxonomyDocSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.message.includes('entries는 최소 1개')) {
      return {
        error: {
          severity: 'error',
          code: 'structural-empty-entries',
          message: `entries가 비어있음: ${first.path.join('.')}`,
        },
      };
    }
    return {
      error: {
        severity: 'error',
        code: 'parse-missing-axes',
        message: `${first.path.join('.')}: ${first.message}`,
      },
    };
  }

  const locs = extractLocs(yamlText);
  const ir = buildIR(parsed.data, locs);
  return { ir };
}

function buildIR(
  doc: TaxonomyDoc,
  locs: Map<string, { line: number; column: number }>,
): TaxonomyIR {
  const axes = new Map<string, AxisIR>();
  for (const [name, axis] of Object.entries(doc.axes)) {
    const entries: EntryIR[] = axis.entries.map((e, i) => {
      const id = typeof e === 'string' ? e : e.id;
      const address = typeof e === 'string' ? i : (e.address ?? i);
      const label = typeof e === 'string' ? undefined : e.label;
      const meta = typeof e === 'string' ? undefined : e.meta;
      const lifecycle = typeof e === 'string' ? undefined : e.lifecycle;
      const placeholderReason = typeof e === 'string' ? undefined : e.placeholderReason;
      const decisionLink = typeof e === 'string' ? undefined : e.decisionLink;
      return {
        id,
        address,
        label,
        meta,
        lifecycle,
        placeholderReason,
        decisionLink,
        _loc: locs.get(`axes.${name}.entries.${i}`),
      };
    });
    const capacity = axis.capacity ?? nextPowerOf2(entries.length * 2);
    axes.set(name, {
      name,
      description: axis.description,
      entries,
      capacity,
      version: axis.version ?? 1,
      lifecycle: axis.lifecycle,
      _loc: locs.get(`axes.${name}`),
    });
  }

  const relations = new Map<string, RelationIR>();
  for (const [name, rel] of Object.entries(doc.relations ?? {})) {
    relations.set(name, {
      name,
      from: Array.isArray(rel.from) ? rel.from : [rel.from],
      to: Array.isArray(rel.to) ? rel.to : [rel.to],
      kind: rel.kind,
      rules: rel.rules,
      _loc: locs.get(`relations.${name}`),
    });
  }

  const constraints: ConstraintIR[] = (doc.constraints ?? []).map((c, i) => ({
    ...c,
    _loc: locs.get(`constraints.${i}`),
  }));

  const contentHash = computeHash({
    taxonomy: doc.taxonomy,
    version: doc.version,
    axes: doc.axes,
    relations: doc.relations,
    constraints: doc.constraints,
  });

  return {
    taxonomy: doc.taxonomy,
    version: doc.version,
    description: doc.description,
    contentHash,
    axes,
    relations,
    constraints,
    imports: doc.imports,
  };
}

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

function computeHash(obj: unknown): string {
  const json = stableStringify(obj);
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * `yaml` 라이브러리(eemeli/yaml)의 CST/AST를 활용한 _loc 추출.
 *
 * 옵션 B 채택 이유: js-yaml listener는 block sequence 아이템마다 open(null)이 2회
 * 발생하고 인라인/블록 구분이 불명확해 경로 추적이 복잡함. `yaml` 라이브러리의
 * parseDocument + LineCounter는 각 노드의 range[0] → linePos() 변환으로
 * multi-line description, nested 객체, comments 등 모든 yaml 구조에서 정확한
 * line/column을 제공한다.
 */
function extractLocs(yamlText: string): Map<string, { line: number; column: number }> {
  const locs = new Map<string, { line: number; column: number }>();

  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter });

    if (!isMap(doc.contents)) return locs;

    // axes 키 찾기
    const axesPair = doc.contents.items.find((p) => isScalar(p.key) && p.key.value === 'axes');
    if (!axesPair || !isMap(axesPair.value)) return locs;

    // 각 축 처리
    for (const axisPair of axesPair.value.items) {
      if (!isScalar(axisPair.key) || !axisPair.key.range) continue;

      const axisName = axisPair.key.value as string;
      const axisKeyPos = lineCounter.linePos(axisPair.key.range[0]);
      locs.set(`axes.${axisName}`, {
        line: axisKeyPos.line,
        column: axisKeyPos.col,
      });

      if (!isMap(axisPair.value)) continue;

      // entries 키 찾기
      const entriesPair = axisPair.value.items.find(
        (p) => isScalar(p.key) && p.key.value === 'entries',
      );
      if (!entriesPair || !isSeq(entriesPair.value)) continue;

      // 각 entry 처리
      for (let i = 0; i < entriesPair.value.items.length; i++) {
        const item = entriesPair.value.items[i];
        if (!item || !item.range) continue;

        const entryPos = lineCounter.linePos(item.range[0]);
        locs.set(`axes.${axisName}.entries.${i}`, {
          line: entryPos.line,
          column: entryPos.col,
        });
      }
    }
  } catch {
    // syntax error는 parse()에서 별도 처리
  }

  return locs;
}
