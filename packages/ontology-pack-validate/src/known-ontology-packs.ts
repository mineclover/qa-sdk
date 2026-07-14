import { authorizationOntologyPack } from 'authorization-ontology';
import type { OperationalOntologyPack } from 'operational-ontology/pack';
import { programmingArtifactOntologyPack } from 'operational-ontology/programming-artifacts';

const KNOWN_ONTOLOGY_PACKS = {
  'programming-artifact-ontology': programmingArtifactOntologyPack,
  'authorization-ontology': authorizationOntologyPack,
} as const satisfies Record<string, OperationalOntologyPack>;

export type KnownOntologyPackId = keyof typeof KNOWN_ONTOLOGY_PACKS;

export const KNOWN_ONTOLOGY_PACK_IDS = Object.freeze(
  Object.keys(KNOWN_ONTOLOGY_PACKS),
) as readonly KnownOntologyPackId[];

export interface KnownOntologyPackResolution {
  readonly ok: true;
  readonly packId: KnownOntologyPackId;
  readonly pack: OperationalOntologyPack;
}

export interface UnknownOntologyPackResolution {
  readonly ok: false;
  readonly error: UnknownOntologyPackError;
}

export interface UnknownOntologyPackError {
  readonly code: 'unknown-ontology-pack';
  readonly message: string;
  readonly packId: string;
  readonly supportedPackIds: readonly KnownOntologyPackId[];
}

export type ResolveKnownOntologyPackResult =
  | KnownOntologyPackResolution
  | UnknownOntologyPackResolution;

export function isKnownOntologyPackId(packId: string): packId is KnownOntologyPackId {
  return Object.prototype.hasOwnProperty.call(KNOWN_ONTOLOGY_PACKS, packId);
}

export function resolveKnownOntologyPack(packId: string): ResolveKnownOntologyPackResult {
  if (isKnownOntologyPackId(packId)) {
    return {
      ok: true,
      packId,
      pack: KNOWN_ONTOLOGY_PACKS[packId],
    };
  }

  return {
    ok: false,
    error: {
      code: 'unknown-ontology-pack',
      message: `Unknown ontology pack id "${packId}". Supported pack ids: ${KNOWN_ONTOLOGY_PACK_IDS.join(', ')}`,
      packId,
      supportedPackIds: KNOWN_ONTOLOGY_PACK_IDS,
    },
  };
}
