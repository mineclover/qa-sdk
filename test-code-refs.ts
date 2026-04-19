import { collectCodeReferences } from "./packages/definition-catalog/src/index.js";

const refs = collectCodeReferences(process.cwd(), { docsDir: "docs", codeDirs: ["packages"] });
const map = new Map<string, number>();

for (const ref of refs) {
  const key = `${ref.codePath}|${ref.docId}|${ref.relationType}|${ref.sourceKind}|${ref.symbol}`;
  const count = map.get(key) || 0;
  if (count > 0) {
    console.log("Duplicate found:", key, ref);
  }
  map.set(key, count + 1);
}
console.log("Total refs:", refs.length);
