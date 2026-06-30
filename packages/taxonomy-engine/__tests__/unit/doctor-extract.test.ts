import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractIdsFromMarkdownTable,
  extractTextsFromMarkdownTable,
  extractDkgExpected,
  extractIngestExpected,
  extractVocabExpected,
} from "../../src/doctor/extract/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INGEST_SPEC = join(
  __dirname,
  "../../../../docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md",
);

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

describe("extractTextsFromMarkdownTable", () => {
  it("plain text 칼럼 추출 + skipBold 기본 적용", () => {
    const md = `
| Name | Other |
|------|-------|
| RecordStore | a |
| TraceStore | b |
| **합계** | x |
`;
    expect(extractTextsFromMarkdownTable(md, 0)).toEqual([
      "RecordStore",
      "TraceStore",
    ]);
  });

  it("skipBold: false 로 굵은 셀도 포함", () => {
    const md = `
| Name | Other |
|------|-------|
| RecordStore | a |
| **합계** | x |
`;
    expect(
      extractTextsFromMarkdownTable(md, 0, { skipBold: false }),
    ).toEqual(["RecordStore", "**합계**"]);
  });

  it("backtick이 있는 셀도 plain text로 추출", () => {
    const md = `
| Name | File |
|------|------|
| RecordStore | \`record.ts\` |
`;
    expect(extractTextsFromMarkdownTable(md, 1)).toEqual(["record.ts"]);
  });
});

describe("extractIngestExpected", () => {
  it("store-adapter-parity.spec.md에서 9 store-kind 추출", () => {
    const md = readFileSync(INGEST_SPEC, "utf8");
    const expected = extractIngestExpected(md);
    expect(expected.taxonomy).toBe("ingest-coords");
    const entries = expected.axes["store-kind"].entries;
    expect(entries.length).toBe(9);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain("record");
    expect(ids).toContain("trace");
    expect(ids).toContain("session");
    expect(ids).toContain("verdict");
    expect(ids).toContain("graph");
    expect(ids).toContain("scenario-spec");
    expect(ids).toContain("transmission");
    expect(ids).toContain("dlq");
    expect(ids).toContain("key-observation");
  });

  it("추출 결과가 기존 hardcoded fixture의 store-kind와 일치", () => {
    const md = readFileSync(INGEST_SPEC, "utf8");
    const extracted = extractIngestExpected(md);
    const hardcoded = JSON.parse(
      readFileSync(
        join(__dirname, "../fixtures/expected-ingest-coords.json"),
        "utf8",
      ),
    );
    const extractedIds = extracted.axes["store-kind"].entries
      .map((e) => e.id)
      .sort();
    const hardcodedIds = hardcoded.axes["store-kind"].entries
      .map((e: { id: string }) => e.id)
      .sort();
    expect(extractedIds).toEqual(hardcodedIds);
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

const VOCAB_TS = join(
  __dirname,
  "../../../../packages/definition-catalog/src/vocabulary.ts",
);

describe("extractVocabExpected", () => {
  it("vocabulary.ts에서 DEF_SCOPE/DEF_DEPTH/DEF_LEVEL/DEF_LIFECYCLE/LINK_TYPE/TAXONOMY_FAMILY 추출", () => {
    const text = readFileSync(VOCAB_TS, "utf8");
    const expected = extractVocabExpected(text);
    expect(expected.taxonomy).toBe("qa-sdk-def-catalog");
    expect(expected.axes["def_scope"].entries.length).toBe(9);
    expect(expected.axes["def_depth"].entries.length).toBe(4);
    expect(expected.axes["def_level"].entries.length).toBe(3);
    // def_lifecycle: vocab 5 + schema tbd = 6 (extractor가 합집합으로 확장)
    expect(expected.axes["def_lifecycle"].entries.length).toBe(6);
    expect(expected.axes["link_type"].entries.length).toBe(10);
    expect(expected.axes["taxonomy_family"].entries.length).toBe(3);
  });

  it("DEF_LEVEL entries: group/module/leaf 순서 정확", () => {
    const text = readFileSync(VOCAB_TS, "utf8");
    const expected = extractVocabExpected(text);
    const ids = expected.axes["def_level"].entries.map((e) => e.id);
    expect(ids).toEqual(["group", "module", "leaf"]);
  });

  it("def_lifecycle entries에 schema 전용 tbd 포함", () => {
    const text = readFileSync(VOCAB_TS, "utf8");
    const expected = extractVocabExpected(text);
    const ids = expected.axes["def_lifecycle"].entries.map((e) => e.id);
    expect(ids).toContain("tbd");
    expect(ids).toEqual(["draft", "review", "approved", "deprecated", "archived", "tbd"]);
  });
});
