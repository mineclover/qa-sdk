// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type {
  OntologyPackKnownPackCandidate,
  OntologyPackScaffoldSymbols,
} from '../ontology-pack-scaffold-plan.js';

export const KNOWN_PACKS_TARGET_PATH = 'packages/cli/src/lib/known-ontology-packs.ts';

export function createKnownPackCandidate(input: {
  readonly packId: string;
  readonly implementationPackage: string;
  readonly symbols: OntologyPackScaffoldSymbols;
}): OntologyPackKnownPackCandidate {
  return {
    targetPath: KNOWN_PACKS_TARGET_PATH,
    packId: input.packId,
    importPath: input.implementationPackage,
    exportSymbolName: input.symbols.packConstantName,
    importName: input.symbols.packConstantName,
    moduleSpecifier: input.implementationPackage,
    registryEntry: `"${input.packId}": ${input.symbols.packConstantName}`,
    registrationMode: 'manual',
    applyMode: 'candidate-only',
  };
}
