// @def.doc federated-connection-contract

import { ConnectionContractError, type SourceRef } from './contract.js';
import { sourceIdentityKey } from './keys.js';
import { validateSourceRef } from './validate.js';

export type SourceLookup = Readonly<Pick<SourceRef, 'sourceSystem' | 'entityType' | 'localId'>>;

export type SourceSnapshotStatus = 'present' | 'deleted';

export type SourceSnapshot<TPayload = unknown> = Readonly<{
  source: SourceRef;
  status: SourceSnapshotStatus;
  observedAt: string;
  payloadHash: string;
  payload?: TPayload;
}>;

export type SourceChangeKind = 'created' | 'updated' | 'deleted' | 'restored' | 'unchanged';

export type SourceChange = Readonly<{
  kind: SourceChangeKind;
  source: SourceRef;
  previous?: SourceRef;
  revisionChanged: boolean;
  payloadChanged: boolean;
}>;

export type SourceObservation<TPayload = unknown> = Readonly<{
  snapshot: SourceSnapshot<TPayload>;
  change: SourceChange;
}>;

export interface SourceAdapter<TPayload = unknown> {
  readonly sourceSystem: string;
  readonly entityType: string;
  readonly identifierRuleVersion?: number;
  fetch(lookup: SourceLookup): Promise<SourceSnapshot<TPayload>>;
}

function validateSnapshot<TPayload>(snapshot: SourceSnapshot<TPayload>): SourceSnapshot<TPayload> {
  validateSourceRef(snapshot.source);
  if (snapshot.status !== 'present' && snapshot.status !== 'deleted') {
    throw new ConnectionContractError(`Unsupported source snapshot status: ${snapshot.status}`);
  }
  if (snapshot.observedAt.length === 0 || Number.isNaN(Date.parse(snapshot.observedAt))) {
    throw new ConnectionContractError('snapshot.observedAt must be an ISO-compatible timestamp');
  }
  if (snapshot.payloadHash.length === 0) {
    throw new ConnectionContractError('snapshot.payloadHash must be a non-empty string');
  }
  return snapshot;
}

function validateLookup(lookup: SourceLookup): SourceLookup {
  if (lookup.sourceSystem.length === 0) {
    throw new ConnectionContractError('lookup.sourceSystem must be a non-empty string');
  }
  if (lookup.entityType.length === 0) {
    throw new ConnectionContractError('lookup.entityType must be a non-empty string');
  }
  if (lookup.localId.length === 0) {
    throw new ConnectionContractError('lookup.localId must be a non-empty string');
  }
  return lookup;
}

export function compareSourceSnapshots<TPayload>(
  previous: SourceSnapshot<TPayload> | undefined,
  current: SourceSnapshot<TPayload>,
): SourceChange {
  validateSnapshot(current);
  if (previous) validateSnapshot(previous);

  if (previous && sourceIdentityKey(previous.source) !== sourceIdentityKey(current.source)) {
    throw new ConnectionContractError('source snapshots must refer to the same source identity');
  }

  const revisionChanged = previous?.source.revision !== current.source.revision;
  const payloadChanged = previous?.payloadHash !== current.payloadHash;
  let kind: SourceChangeKind;

  if (!previous) kind = current.status === 'deleted' ? 'deleted' : 'created';
  else if (previous.status === 'deleted' && current.status === 'present') kind = 'restored';
  else if (current.status === 'deleted') kind = 'deleted';
  else if (revisionChanged || payloadChanged) kind = 'updated';
  else kind = 'unchanged';

  return {
    kind,
    source: { ...current.source },
    ...(previous ? { previous: { ...previous.source } } : {}),
    revisionChanged,
    payloadChanged,
  };
}

export async function observeSource<TPayload>(
  adapter: SourceAdapter<TPayload>,
  lookup: SourceLookup,
  previous?: SourceSnapshot<TPayload>,
): Promise<SourceObservation<TPayload>> {
  validateLookup(lookup);
  if (lookup.sourceSystem !== adapter.sourceSystem || lookup.entityType !== adapter.entityType) {
    throw new ConnectionContractError('lookup does not match source adapter identity');
  }

  const snapshot = validateSnapshot(await adapter.fetch(lookup));
  const expectedIdentity = `${adapter.sourceSystem}:${adapter.entityType}:${lookup.localId}`;
  const actualIdentity = `${snapshot.source.sourceSystem}:${snapshot.source.entityType}:${snapshot.source.localId}`;
  if (actualIdentity !== expectedIdentity) {
    throw new ConnectionContractError(
      `source adapter returned ${actualIdentity}; expected ${expectedIdentity}`,
    );
  }

  return { snapshot, change: compareSourceSnapshots(previous, snapshot) };
}
