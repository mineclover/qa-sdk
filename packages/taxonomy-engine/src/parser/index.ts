import * as yaml from "js-yaml";
import { createHash } from "node:crypto";
import { TaxonomyDocSchema, type TaxonomyDoc } from "../schema/zod.js";
import type {
  TaxonomyIR,
  AxisIR,
  EntryIR,
  RelationIR,
  ConstraintIR,
} from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export type ParseError = Diagnostic;

export type ParseResult = { ir: TaxonomyIR } | { error: ParseError };

export function parse(yamlText: string): ParseResult {
  let raw: unknown;
  try {
    raw = yaml.load(yamlText);
  } catch (e) {
    const mark = (e as { mark?: { line: number; column: number } }).mark;
    return {
      error: {
        severity: "error",
        code: "parse-yaml-syntax",
        message: `YAML 문법 오류: ${(e as Error).message}`,
        location: mark ? { line: mark.line + 1, column: mark.column + 1 } : undefined,
      },
    };
  }

  const parsed = TaxonomyDocSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.message.includes("entries는 최소 1개")) {
      return {
        error: {
          severity: "error",
          code: "structural-empty-entries",
          message: `entries가 비어있음: ${first.path.join(".")}`,
        },
      };
    }
    return {
      error: {
        severity: "error",
        code: "parse-missing-axes",
        message: `${first.path.join(".")}: ${first.message}`,
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
      const id = typeof e === "string" ? e : e.id;
      const address = typeof e === "string" ? i : (e.address ?? i);
      const label = typeof e === "string" ? undefined : e.label;
      const meta = typeof e === "string" ? undefined : e.meta;
      return {
        id,
        address,
        label,
        meta,
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
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function extractLocs(yamlText: string): Map<string, { line: number; column: number }> {
  const locs = new Map<string, { line: number; column: number }>();
  const lines = yamlText.split("\n");
  let axisName: string | null = null;
  let inAxes = false;
  let inEntries = false;
  let entryIdx = 0;
  let entriesIndent = 0;

  lines.forEach((line, i) => {
    const trimmed = line.replace(/\s+$/, "");
    if (/^axes:\s*$/.test(trimmed)) {
      inAxes = true;
      inEntries = false;
    } else if (/^[a-zA-Z]/.test(trimmed) && !/^\s/.test(line)) {
      inAxes = false;
      inEntries = false;
    }

    if (!inAxes) return;

    // 축 시작: "  scope:"
    const axisMatch = trimmed.match(/^\s{2}([a-zA-Z_][\w-]*)\s*:/);
    if (axisMatch && /^\s{2}\S/.test(line)) {
      axisName = axisMatch[1];
      entryIdx = 0;
      inEntries = false;
      locs.set(`axes.${axisName}`, { line: i + 1, column: line.indexOf(axisName) + 1 });
      return;
    }

    // entries: 시작 — inline 또는 block
    const inlineEntries = trimmed.match(/^\s{4}entries:\s*\[(.+)\]/);
    if (inlineEntries && axisName) {
      const items = inlineEntries[1].split(",").map((s) => s.trim());
      items.forEach((_, j) => {
        locs.set(`axes.${axisName}.entries.${j}`, {
          line: i + 1,
          column: line.indexOf(items[j]) + 1,
        });
      });
      inEntries = false;
      return;
    }

    const blockEntriesStart = trimmed.match(/^(\s{4})entries:\s*$/);
    if (blockEntriesStart && axisName) {
      inEntries = true;
      entryIdx = 0;
      entriesIndent = blockEntriesStart[1].length;
      return;
    }

    // 블록 entry: "      - apm"  또는  "      - { id: foo, ... }"
    if (inEntries && axisName) {
      const dashMatch = line.match(/^(\s+)-\s*(.+)$/);
      if (dashMatch && dashMatch[1].length > entriesIndent) {
        const valuePart = dashMatch[2].trim();
        // 오브젝트면 id 추출
        const idMatch = valuePart.match(/id\s*:\s*([^\s,}]+)/);
        const display = idMatch ? idMatch[1] : valuePart;
        const col = line.indexOf(display) + 1;
        locs.set(`axes.${axisName}.entries.${entryIdx}`, {
          line: i + 1,
          column: col > 0 ? col : line.indexOf("-") + 1,
        });
        entryIdx++;
        return;
      }
      // entries 블록 종료 — indent가 줄어들거나 새 키
      if (trimmed.length > 0 && !line.startsWith(" ".repeat(entriesIndent + 2))) {
        inEntries = false;
      }
    }
  });

  return locs;
}
