import type {
  FacetKindValidationResult,
  FacetPayloadShapeValidationResult,
  OperationalOntologyFacetKind,
  OperationalOntologyFacetRecord,
  OperationalOntologyObjectKind,
  OperationalOntologyObjectRecord,
  OperationalOntologyObservationKind,
  OperationalOntologyObservationRecord,
  OperationalOntologyProjectionRecord,
} from "./persistence-core.js";
import {
  validateFacetKindsForObjectKind,
  validateFacetPayloadShape,
} from "./persistence-core.js";

export interface OperationalOntologyObjectQuery {
  objectKind?: OperationalOntologyObjectKind;
  canonicalKey?: string;
  lifecycle?: string;
}

export interface OperationalOntologyObservationQuery {
  targetObjectId?: string;
  observationKind?: OperationalOntologyObservationKind;
}

export interface OperationalOntologyProjectionQuery {
  targetScope?: string;
  projectionKind?: string;
}

export interface OperationalOntologyFacetPayloadValidation {
  facetKind: OperationalOntologyFacetKind;
  version: string;
  validation: FacetPayloadShapeValidationResult;
}

export interface OperationalOntologyObjectBundle {
  object: OperationalOntologyObjectRecord;
  facets: OperationalOntologyFacetRecord[];
  observations: OperationalOntologyObservationRecord[];
  projections: OperationalOntologyProjectionRecord[];
  facetValidation: FacetKindValidationResult;
  payloadValidations: OperationalOntologyFacetPayloadValidation[];
}

export interface OperationalOntologyStore {
  upsertObject(record: OperationalOntologyObjectRecord): Promise<void>;
  findObjectById(objectId: string): Promise<OperationalOntologyObjectRecord | null>;
  findObjectByCanonicalKey(canonicalKey: string): Promise<OperationalOntologyObjectRecord | null>;
  listObjects(query?: OperationalOntologyObjectQuery): Promise<OperationalOntologyObjectRecord[]>;
  putFacet(record: OperationalOntologyFacetRecord): Promise<void>;
  listFacets(objectId: string): Promise<OperationalOntologyFacetRecord[]>;
  appendObservation(record: OperationalOntologyObservationRecord): Promise<void>;
  listObservations(
    query?: OperationalOntologyObservationQuery,
  ): Promise<OperationalOntologyObservationRecord[]>;
  putProjection(record: OperationalOntologyProjectionRecord): Promise<void>;
  listProjections(
    query?: OperationalOntologyProjectionQuery,
  ): Promise<OperationalOntologyProjectionRecord[]>;
  getObjectBundle(objectId: string): Promise<OperationalOntologyObjectBundle | null>;
}

function compareByTimestamp(left: string, right: string): number {
  return left.localeCompare(right);
}

export class InMemoryOperationalOntologyStore implements OperationalOntologyStore {
  private readonly objects = new Map<string, OperationalOntologyObjectRecord>();
  private readonly facetsByObjectId = new Map<string, OperationalOntologyFacetRecord[]>();
  private readonly observations: OperationalOntologyObservationRecord[] = [];
  private readonly projections: OperationalOntologyProjectionRecord[] = [];

  async upsertObject(record: OperationalOntologyObjectRecord): Promise<void> {
    this.objects.set(record.objectId, structuredClone(record));
  }

  async findObjectById(objectId: string): Promise<OperationalOntologyObjectRecord | null> {
    const record = this.objects.get(objectId);
    return record ? structuredClone(record) : null;
  }

  async findObjectByCanonicalKey(
    canonicalKey: string,
  ): Promise<OperationalOntologyObjectRecord | null> {
    const matched = [...this.objects.values()].find(
      (record) => record.canonicalKey === canonicalKey,
    );
    return matched ? structuredClone(matched) : null;
  }

  async listObjects(
    query: OperationalOntologyObjectQuery = {},
  ): Promise<OperationalOntologyObjectRecord[]> {
    return [...this.objects.values()]
      .filter((record) => {
        if (query.objectKind && record.objectKind !== query.objectKind) return false;
        if (query.canonicalKey && record.canonicalKey !== query.canonicalKey) return false;
        if (query.lifecycle && record.lifecycle !== query.lifecycle) return false;
        return true;
      })
      .map((record) => structuredClone(record));
  }

  async putFacet(record: OperationalOntologyFacetRecord): Promise<void> {
    const object = this.objects.get(record.objectId);
    if (!object) {
      throw new Error(`Unknown operational ontology object: ${record.objectId}`);
    }

    const existingFacets = this.facetsByObjectId.get(record.objectId) ?? [];
    const nextFacets = [
      ...existingFacets.filter(
        (facet) =>
          !(
            facet.facetKind === record.facetKind && facet.version === record.version
          ),
      ),
      structuredClone(record),
    ];

    const facetValidation = validateFacetKindsForObjectKind(
      object.objectKind,
      nextFacets.map((facet) => facet.facetKind),
    );
    if (facetValidation.disallowed.includes(record.facetKind)) {
      throw new Error(
        `Facet kind "${record.facetKind}" is not allowed for object kind "${object.objectKind}"`,
      );
    }

    const payloadValidation = validateFacetPayloadShape(
      object.objectKind,
      record.facetKind,
      record.payloadJson,
    );
    if (!payloadValidation.valid) {
      throw new Error(
        `Invalid payload shape for ${object.objectKind}/${record.facetKind}: missing ${payloadValidation.missingKeys.join(", ")}`,
      );
    }

    this.facetsByObjectId.set(
      record.objectId,
      nextFacets.toSorted((left, right) =>
        compareByTimestamp(left.recordedAt, right.recordedAt),
      ),
    );
  }

  async listFacets(objectId: string): Promise<OperationalOntologyFacetRecord[]> {
    return (this.facetsByObjectId.get(objectId) ?? []).map((facet) =>
      structuredClone(facet),
    );
  }

  async appendObservation(record: OperationalOntologyObservationRecord): Promise<void> {
    if (!this.objects.has(record.targetObjectId)) {
      throw new Error(`Unknown observation target object: ${record.targetObjectId}`);
    }

    this.observations.push(structuredClone(record));
  }

  async listObservations(
    query: OperationalOntologyObservationQuery = {},
  ): Promise<OperationalOntologyObservationRecord[]> {
    return this.observations
      .filter((record) => {
        if (query.targetObjectId && record.targetObjectId !== query.targetObjectId) {
          return false;
        }
        if (query.observationKind && record.observationKind !== query.observationKind) {
          return false;
        }
        return true;
      })
      .toSorted((left, right) => compareByTimestamp(left.observedAt, right.observedAt))
      .map((record) => structuredClone(record));
  }

  async putProjection(record: OperationalOntologyProjectionRecord): Promise<void> {
    const next = structuredClone(record);
    const index = this.projections.findIndex(
      (projection) => projection.projectionId === next.projectionId,
    );

    if (index >= 0) {
      this.projections[index] = next;
    } else {
      this.projections.push(next);
    }
  }

  async listProjections(
    query: OperationalOntologyProjectionQuery = {},
  ): Promise<OperationalOntologyProjectionRecord[]> {
    return this.projections
      .filter((record) => {
        if (query.targetScope && record.targetScope !== query.targetScope) return false;
        if (query.projectionKind && record.projectionKind !== query.projectionKind) {
          return false;
        }
        return true;
      })
      .toSorted((left, right) => compareByTimestamp(left.builtAt, right.builtAt))
      .map((record) => structuredClone(record));
  }

  async getObjectBundle(objectId: string): Promise<OperationalOntologyObjectBundle | null> {
    const object = this.objects.get(objectId);
    if (!object) {
      return null;
    }

    const facets = this.facetsByObjectId.get(objectId) ?? [];
    const observations = this.observations.filter(
      (observation) => observation.targetObjectId === objectId,
    );
    const projections = this.projections.filter((projection) =>
      projection.builtFrom.includes(objectId),
    );

    return {
      object: structuredClone(object),
      facets: facets.map((facet) => structuredClone(facet)),
      observations: observations.map((observation) => structuredClone(observation)),
      projections: projections.map((projection) => structuredClone(projection)),
      facetValidation: validateFacetKindsForObjectKind(
        object.objectKind,
        facets.map((facet) => facet.facetKind),
      ),
      payloadValidations: facets.map((facet) => ({
        facetKind: facet.facetKind,
        version: facet.version,
        validation: validateFacetPayloadShape(
          object.objectKind,
          facet.facetKind,
          facet.payloadJson,
        ),
      })),
    };
  }
}
