import type { OperationalOntologyStore } from './persistence-memory.js';
import {
  DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY,
} from './implementation-governance-taxonomy.js';
import {
  validateImplementationBlueprint,
} from './implementation-governance-evaluator.js';
import type {
  GovernanceRun,
  ImplementationBlueprint,
  PersistImplementationGovernanceBlueprintOptions,
  PersistImplementationGovernanceBlueprintResult,
  PersistImplementationGovernanceRunOptions,
  PersistImplementationGovernanceRunResult,
} from './implementation-governance-types.js';

export async function persistImplementationGovernanceRun(
  store: Pick<
    OperationalOntologyStore,
    'findObjectById' | 'upsertObject' | 'putFacet' | 'appendObservation'
  >,
  run: GovernanceRun,
  options: PersistImplementationGovernanceRunOptions = {},
): Promise<PersistImplementationGovernanceRunResult> {
  const now = options.now ?? new Date().toISOString();
  const objectId = options.objectId ?? run.runId;
  const schemaVersion = options.schemaVersion ?? 'v1';
  const state = run.constraintVerdicts.every((verdict) => verdict.valid) ? 'passed' : 'failed';
  const lifecycle = options.lifecycle ?? 'active';
  const existing = await store.findObjectById(objectId);
  const evidenceFacetVersion = `${schemaVersion}:evidence:${now}`;
  const statusFacetVersion = `${schemaVersion}:status:${now}`;

  await store.upsertObject({
    objectId,
    objectKind: 'governance_run',
    canonicalKey: `${run.familyKey}:${run.runId}`,
    schemaVersion,
    lifecycle,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'evidence',
    version: evidenceFacetVersion,
    payloadJson: {
      implementationRefs: run.implementationRefs,
      verificationRefs: run.verificationRefs,
      constraintVerdicts: run.constraintVerdicts,
      adjustmentRecords: run.adjustmentRecords,
    },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'status',
    version: statusFacetVersion,
    payloadJson: {
      state,
      reason: state === 'passed' ? 'All governance constraints passed' : 'Governance constraints failed',
    },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'aggregate',
    version: `${schemaVersion}:aggregate:${now}`,
    payloadJson: {
      adjustmentCount: run.adjustmentRecords.length,
      verdictCount: run.constraintVerdicts.length,
    },
    recordedAt: now,
  });

  if (options.appendObservation ?? true) {
    const observationId = `observation:${encodeURIComponent(objectId)}:${encodeURIComponent(now)}`;
    await store.appendObservation({
      observationId,
      targetObjectId: objectId,
      observationKind: 'governance_evaluated',
      payloadJson: {
        blueprintId: run.blueprintId,
        familyKey: run.familyKey,
        state,
        adjustmentCount: run.adjustmentRecords.length,
      },
      observedAt: now,
    });

    return { objectId, evidenceFacetVersion, statusFacetVersion, observationId };
  }

  return { objectId, evidenceFacetVersion, statusFacetVersion };
}

export async function persistImplementationGovernanceBlueprint(
  store: Pick<OperationalOntologyStore, 'findObjectById' | 'upsertObject' | 'putFacet'>,
  blueprint: ImplementationBlueprint,
  options: PersistImplementationGovernanceBlueprintOptions = {},
): Promise<PersistImplementationGovernanceBlueprintResult> {
  const now = options.now ?? new Date().toISOString();
  const objectId = options.objectId ?? `governance-blueprint:${blueprint.blueprintId}`;
  const schemaVersion = options.schemaVersion ?? 'v1';
  const taxonomy = options.taxonomy ?? DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY;
  const validation = validateImplementationBlueprint({
    blueprint,
    schema: options.schema,
    taxonomy,
  });
  if (!validation.valid && !options.allowInvalid) {
    throw new Error(
      `Cannot persist invalid implementation governance blueprint: ${validation.verdicts.map((verdict) => verdict.code).join(', ')}`,
    );
  }

  const lifecycle = options.lifecycle ?? (validation.valid ? 'active' : 'draft');
  const existing = await store.findObjectById(objectId);
  const schemaFacetVersion = `${schemaVersion}:schema:${now}`;
  const validationFacetVersion = `${schemaVersion}:validation:${now}`;
  const grammarFacetVersion = `${schemaVersion}:grammar:${now}`;

  await store.upsertObject({
    objectId,
    objectKind: 'governance_blueprint',
    canonicalKey: `governance-blueprint:${blueprint.coordinateRef}:${blueprint.blueprintId}`,
    schemaVersion,
    lifecycle,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'schema',
    version: schemaFacetVersion,
    payloadJson: { blueprint },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'validation',
    version: validationFacetVersion,
    payloadJson: {
      valid: validation.valid,
      issues: validation.verdicts,
    },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'grammar',
    version: grammarFacetVersion,
    payloadJson: { taxonomy },
    recordedAt: now,
  });

  return { objectId, schemaFacetVersion, validationFacetVersion, grammarFacetVersion };
}
