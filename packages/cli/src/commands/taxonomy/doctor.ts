import { readFileSync, existsSync } from "node:fs";
import { join, resolve as pathResolve, dirname } from "node:path";
import { parse, doctor, extractDkgExpected, extractIngestExpected, extractVocabExpected, type ExpectedTaxonomy } from "taxonomy-engine";
import { printDiagnostics } from "./shared.js";

export const AUTO_EXTRACT_MAP: Record<string, (repoRoot: string) => ExpectedTaxonomy> = {
  "dkg-schema": (root) => {
    const nodePath = join(root, "docs/specs/dkg-system/dkg-node-types.spec.md");
    const edgePath = join(root, "docs/specs/dkg-system/dkg-edge-types.spec.md");
    const nodeText = readFileSync(nodePath, "utf8");
    const edgeText = readFileSync(edgePath, "utf8");
    return extractDkgExpected(nodeText, edgeText);
  },
  "ingest-coords": (root) => {
    const mdPath = join(root, "docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md");
    const mdText = readFileSync(mdPath, "utf8");
    return extractIngestExpected(mdText);
  },
  "qa-sdk-def-catalog": (root) => {
    const tsPath = join(root, "packages/definition-catalog/src/vocabulary.ts");
    const tsText = readFileSync(tsPath, "utf8");
    return extractVocabExpected(tsText);
  },
};

export function findRepoRoot(filePath: string): string | undefined {
  let dir = pathResolve(dirname(filePath));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = pathResolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function doctorCmd(args: string[]): void {
  const json = args.includes("--json");
  const auto = args.includes("--auto");
  const expectedIdx = args.indexOf("--expected");
  const expectedPath = expectedIdx >= 0 ? args[expectedIdx + 1] : undefined;
  const positional = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (i > 0 && args[i - 1] === "--expected") return false;
    return true;
  });
  const file = positional[0];

  if (!file) {
    console.error("사용법: qa-sdk tax doctor <file> (--expected <file> | --auto) [--json]");
    process.exit(1);
    return;
  }
  if (!expectedPath && !auto) {
    console.error("--expected <file> 또는 --auto 필요");
    process.exit(1);
    return;
  }

  let yamlText: string;
  try {
    yamlText = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`파일 읽기 실패: ${file} — ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const parsed = parse(yamlText);
  if ("error" in parsed) {
    console.error(`parse 실패: ${parsed.error.message}`);
    process.exit(1);
    return;
  }

  let expected: ExpectedTaxonomy;
  if (auto) {
    const base = file.split("/").pop()?.replace(".yaml", "") || "";
    const extractor = AUTO_EXTRACT_MAP[base];
    if (!extractor) {
      const supportedNames = Object.keys(AUTO_EXTRACT_MAP).join(", ");
      console.error(`--auto 지원 매핑 없음: ${base}. --expected로 명시 필요. 지원: ${supportedNames}`);
      process.exit(1);
      return;
    }
    const repoRoot = findRepoRoot(file) ?? process.cwd();
    try {
      expected = extractor(repoRoot);
    } catch (e) {
      console.error(`--auto 추출 실패: ${(e as Error).message}`);
      process.exit(1);
      return;
    }
  } else {
    try {
      expected = JSON.parse(readFileSync(expectedPath!, "utf8"));
    } catch (e) {
      console.error(`expected 파일 읽기 실패: ${(e as Error).message}`);
      process.exit(1);
      return;
    }
  }

  const diags = doctor(parsed.ir, expected);
  printDiagnostics(diags, { json, file });
  const errors = diags.filter((d) => d.severity === "error");
  if (errors.length > 0) process.exit(1);
}
