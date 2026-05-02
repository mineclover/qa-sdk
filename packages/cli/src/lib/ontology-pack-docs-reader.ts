// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from "node:fs";
import { join } from "node:path";

import type { OntologyPackDocsFamilyReader } from "ontology-pack-validate";
import { filterMatchingDocsForPack } from "ontology-pack-validate";

import { createDefinitionMarkdownAdapter } from "./docs-control-plane/adapters/definition-markdown.js";

/**
 * docs family reader backed by the cli's definition-markdown adapter.
 *
 * `ontology-pack-validate`는 환경 독립성을 위해 adapter를 모른다. 이 cli는
 * definition-markdown adapter로 문서를 수집하고 pack 매칭 필터를 적용한 reader를
 * 주입한다. `docs/` 디렉토리가 없으면 빈 리스트를 반환해 기본 동작 안정성을
 * 유지한다 (이전 내장 구현과 동일).
 */
export const readDocsFamilyFromDefinitionMarkdown: OntologyPackDocsFamilyReader = async ({
  packId,
  rootDir,
}) => {
  if (!existsSync(join(rootDir, "docs"))) return [];
  const adapter = createDefinitionMarkdownAdapter({ rootDir, docsDirs: ["docs"] });
  const docs = await adapter.listDocuments();
  return filterMatchingDocsForPack(packId, docs);
};
