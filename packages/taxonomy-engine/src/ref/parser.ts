import type { TaxonomyRef } from "./types.js";

export function parseRef(input: string): TaxonomyRef {
  const { taxonomy, version, rest } = splitTaxonomyVersion(input);
  if (rest === "") return { taxonomy, version, kind: "taxonomy" };

  if (rest.startsWith("::")) return parseAddressRef(taxonomy, version, rest.slice(2));
  if (rest.startsWith("#")) return parsePointerRef(taxonomy, version, rest.slice(1));
  if (rest.startsWith(":")) return parseDottedRef(taxonomy, version, rest.slice(1));

  throw new Error(`잘못된 ref 형식: ${input}`);
}

function splitTaxonomyVersion(input: string): {
  taxonomy: string;
  version?: number;
  rest: string;
} {
  const m = input.match(/^([a-zA-Z][\w-]*)(@v(\d+))?(.*)$/);
  if (!m) throw new Error(`잘못된 ref taxonomy 형식: ${input}`);
  return {
    taxonomy: m[1],
    version: m[3] ? Number(m[3]) : undefined,
    rest: m[4] ?? "",
  };
}

function parsePointerRef(
  taxonomy: string,
  version: number | undefined,
  ptr: string,
): TaxonomyRef {
  const parts = ptr.split("/").filter(Boolean);
  if (parts.length === 0) return { taxonomy, version, kind: "taxonomy" };
  if (parts[0] === "axes") {
    const axis = parts[1];
    if (parts.length === 2) return { taxonomy, version, kind: "axis", axis };
    if (parts[2] === "entries") {
      const entry = parts[3];
      if (parts.length === 4) return { taxonomy, version, kind: "entry", axis, entry };
      return {
        taxonomy,
        version,
        kind: "entry-field",
        axis,
        entry,
        pointer: parts.slice(4),
      };
    }
  }
  if (parts[0] === "relations") {
    const relation = parts[1];
    if (parts.length === 2) return { taxonomy, version, kind: "relation", relation };
    if (parts[2] === "rules") {
      return {
        taxonomy,
        version,
        kind: "relation-rule",
        relation,
        ruleIdx: Number(parts[3]),
      };
    }
  }
  if (parts[0] === "constraints") {
    return { taxonomy, version, kind: "constraint", constraint: parts[1] };
  }
  throw new Error(`알 수 없는 pointer 경로: ${ptr}`);
}

function parseDottedRef(
  taxonomy: string,
  version: number | undefined,
  body: string,
): TaxonomyRef {
  const coordMatch = body.match(/^coord\{(.+)\}$/);
  if (coordMatch) {
    const coord: Record<string, string> = {};
    for (const pair of coordMatch[1].split(",")) {
      const [k, v] = pair.split("=").map((s) => s.trim());
      coord[k] = v;
    }
    return { taxonomy, version, kind: "coordinate", coord };
  }
  if (body.startsWith("relations/")) {
    const parts = body.split("/");
    const relation = parts[1];
    if (parts[2] === "rules") {
      return {
        taxonomy,
        version,
        kind: "relation-rule",
        relation,
        ruleIdx: Number(parts[3]),
      };
    }
    return { taxonomy, version, kind: "relation", relation };
  }
  if (body.startsWith("constraints/")) {
    return {
      taxonomy,
      version,
      kind: "constraint",
      constraint: body.slice("constraints/".length),
    };
  }
  const dotIdx = body.indexOf(".");
  if (dotIdx === -1) return { taxonomy, version, kind: "axis", axis: body };
  const axis = body.slice(0, dotIdx);
  const entry = body.slice(dotIdx + 1);
  return { taxonomy, version, kind: "entry", axis, entry };
}

function parseAddressRef(
  taxonomy: string,
  version: number | undefined,
  body: string,
): TaxonomyRef {
  if (body.startsWith("coord:")) {
    throw new Error(`coord:address 디코딩은 axes 정보 필요. resolver 사용.`);
  }
  const m = body.match(/^([a-zA-Z][\w-]*)#(\d+)$/);
  if (!m) throw new Error(`잘못된 address ref: ${body}`);
  return {
    taxonomy,
    version,
    kind: "entry-by-address",
    axis: m[1],
    address: Number(m[2]),
  };
}
