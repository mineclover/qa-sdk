import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractIdsFromMarkdownTable,
  extractDkgExpected,
} from "../../src/doctor/extract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NODE_SPEC = join(
  __dirname,
  "../../../../docs/specs/dkg-system/dkg-node-types.spec.md",
);
const EDGE_SPEC = join(
  __dirname,
  "../../../../docs/specs/dkg-system/dkg-edge-types.spec.md",
);

describe("extractIdsFromMarkdownTable", () => {
  it("backtick id 목록 추출", () => {
    const md = `
some text

| 계층 | 노드 | 설명 |
|------|------|------|
| 카탈로그 (4종) | \`axis\`, \`prefix\`, \`spec\`, \`schema\` | 설명 |
| 설계+운영 (4종) | \`decision\`, \`observation\` | 설명 |

after table
`;
    const ids = extractIdsFromMarkdownTable(md, 1);
    expect(ids).toEqual([
      "axis",
      "prefix",
      "spec",
      "schema",
      "decision",
      "observation",
    ]);
  });

  it("표 없으면 빈 배열", () => {
    expect(extractIdsFromMarkdownTable("just text", 1)).toEqual([]);
  });

  it("backtick 없는 셀 skip", () => {
    const md = `
| col | data | x |
|-----|------|---|
| a   | plain text | b |
| c   | \`real-id\` | d |
`;
    expect(extractIdsFromMarkdownTable(md, 1)).toEqual(["real-id"]);
  });
});

describe("extractDkgExpected", () => {
  it("DKG spec 파일에서 16 노드 + 18 엣지 추출", () => {
    const nodeMd = readFileSync(NODE_SPEC, "utf8");
    const edgeMd = readFileSync(EDGE_SPEC, "utf8");
    const expected = extractDkgExpected(nodeMd, edgeMd);
    expect(expected.taxonomy).toBe("dkg-schema");
    expect(expected.axes["node-kind"].entries.length).toBe(16);
    expect(expected.axes["edge-kind"].entries.length).toBe(18);
  });

  it("추출 결과의 entries 순서가 기존 hardcoded expected와 일치", () => {
    const nodeMd = readFileSync(NODE_SPEC, "utf8");
    const edgeMd = readFileSync(EDGE_SPEC, "utf8");
    const extracted = extractDkgExpected(nodeMd, edgeMd);
    const hardcoded = JSON.parse(
      readFileSync(
        join(__dirname, "../fixtures/expected-dkg-schema.json"),
        "utf8",
      ),
    );

    const extractedNodeIds = extracted.axes["node-kind"].entries.map(
      (e) => e.id,
    );
    const hardcodedNodeIds = hardcoded.axes["node-kind"].entries.map(
      (e: { id: string }) => e.id,
    );
    expect(extractedNodeIds).toEqual(hardcodedNodeIds);

    const extractedEdgeIds = extracted.axes["edge-kind"].entries.map(
      (e) => e.id,
    );
    const hardcodedEdgeIds = hardcoded.axes["edge-kind"].entries.map(
      (e: { id: string }) => e.id,
    );
    expect(extractedEdgeIds).toEqual(hardcodedEdgeIds);
  });
});
