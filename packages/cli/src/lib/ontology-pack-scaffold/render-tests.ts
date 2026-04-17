import { posix as pathPosix } from 'node:path';

import type { OntologyPackScaffoldIdentity } from '../ontology-pack-scaffold-plan.js';

export function renderPackTestFile(
  identity: OntologyPackScaffoldIdentity,
  testPath: string,
  systemBindingPath: string,
): string {
  const { symbols } = identity;
  const importPath = toRelativeJsModuleSpecifier(testPath, systemBindingPath);
  return `import { describe, expect, it } from "vitest";

import {
  ${symbols.packConstantName},
  ${symbols.validateFunctionName},
} from "${importPath}";

describe("${identity.packId} ontology pack", () => {
  it("validates the pack contract", () => {
    expect(${symbols.validateFunctionName}().valid).toBe(true);
    expect(${symbols.packConstantName}.packId).toBe("${identity.packId}");
  });

  it("documents domain axis and taxonomy expectations", () => {
    // TODO(pack-author): Replace scaffold expectations with domain-specific axis and taxonomy invariants.
    expect(${symbols.packConstantName}.schema.axes.map((axis) => axis.id)).toContain("${identity.defaultAxisId}");
    expect(${symbols.packConstantName}.schema.taxonomies.map((taxonomy) => taxonomy.id)).toContain("${identity.defaultTaxonomyId}");
  });

  it("documents blueprint and system binding expectations", () => {
    // TODO(pack-author): Replace scaffold expectations with domain-specific blueprint and system binding invariants.
    expect(${symbols.packConstantName}.blueprints?.map((blueprint) => blueprint.blueprintId)).toContain("${identity.safePackId}-binding");
    expect(${symbols.packConstantName}.blueprints?.some((blueprint) =>
      blueprint.verificationBinding?.verificationRefs.some((ref) => ref.kind === "test"),
    )).toBe(true);
  });
});
`;
}

function normalizeRepoPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function toRelativeJsModuleSpecifier(fromFilePath: string, toFilePath: string): string {
  const fromDir = pathPosix.dirname(normalizeRepoPath(fromFilePath));
  const toJsPath = normalizeRepoPath(toFilePath).replace(/\.ts$/, '.js');
  const relativePath = pathPosix.relative(fromDir, toJsPath);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}
