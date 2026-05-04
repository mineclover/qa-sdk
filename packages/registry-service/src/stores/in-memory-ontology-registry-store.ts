// @def.boundary registry-system
// @def.doc registry-system

import {
  OntologyRegistryStoreError,
  type OntologyAddressAllocationRecord,
  type OntologyAddressSegmentRecord,
  type OntologyAllocationPlanWriteSet,
  type OntologyAxisRecord,
  type OntologyNamespaceRecord,
  type OntologyRegistryStore,
  type OntologyTaxonomyRecord,
} from "./ontology-registry-store.js";
import {
  recordsFromOntologyAllocationPlanWriteSet,
  type OntologyRegistryRecordSet,
  validateOntologyRegistryRows,
} from "./ontology-registry-validation.js";

export class InMemoryOntologyRegistryStore implements OntologyRegistryStore {
  private readonly namespaces = new Map<string, OntologyNamespaceRecord>();
  private readonly axes = new Map<string, OntologyAxisRecord>();
  private readonly taxonomies = new Map<string, OntologyTaxonomyRecord>();
  private readonly allocations = new Map<string, OntologyAddressAllocationRecord>();
  private readonly segments = new Map<string, OntologyAddressSegmentRecord>();

  async writeAllocationPlan(writeSet: OntologyAllocationPlanWriteSet): Promise<void> {
    const attempted = recordsFromOntologyAllocationPlanWriteSet(writeSet);
    const conflicts = validateOntologyRegistryRows({
      existing: this.snapshot(),
      attempted,
    });

    if (conflicts.length > 0) {
      throw new OntologyRegistryStoreError({
        code: "partial-write-rejected",
        message: `Ontology allocation plan write rejected with ${conflicts.length} conflict(s)`,
        conflicts,
      });
    }

    this.namespaces.set(writeSet.namespace.ontologyId, cloneNamespace(writeSet.namespace));
    for (const axis of writeSet.axes) {
      this.axes.set(axisKey(axis.ontologyId, axis.axisId, axis.versionId), cloneAxis(axis));
    }
    for (const taxonomy of writeSet.taxonomies) {
      this.taxonomies.set(
        taxonomyKey(taxonomy.ontologyId, taxonomy.taxonomyId, taxonomy.versionId),
        cloneTaxonomy(taxonomy),
      );
    }
    for (const allocation of writeSet.allocations) {
      this.allocations.set(allocation.allocationId, cloneAllocation(allocation));
    }
    for (const segment of writeSet.segments) {
      this.segments.set(segmentKey(segment.allocationId, segment.segmentId), cloneSegment(segment));
    }
  }

  async updateAllocationStatus(
    allocationId: string,
    status: OntologyAddressAllocationRecord["status"],
  ): Promise<OntologyAddressAllocationRecord | null> {
    const existing = this.allocations.get(allocationId);
    if (!existing) {
      return null;
    }

    const updated = cloneAllocation({ ...existing, status });
    this.allocations.set(allocationId, updated);
    return cloneAllocation(updated);
  }

  async listNamespaces(): Promise<OntologyNamespaceRecord[]> {
    return [...this.namespaces.values()]
      .map(cloneNamespace)
      .toSorted((left, right) => left.ontologyId.localeCompare(right.ontologyId));
  }

  async getNamespace(ontologyId: string): Promise<OntologyNamespaceRecord | null> {
    const record = this.namespaces.get(ontologyId);
    return record ? cloneNamespace(record) : null;
  }

  async listAxes(ontologyId: string, versionId: string): Promise<OntologyAxisRecord[]> {
    return [...this.axes.values()]
      .filter((axis) => axis.ontologyId === ontologyId && axis.versionId === versionId)
      .map(cloneAxis)
      .toSorted((left, right) => left.axisId.localeCompare(right.axisId));
  }

  async listTaxonomies(ontologyId: string, versionId: string): Promise<OntologyTaxonomyRecord[]> {
    return [...this.taxonomies.values()]
      .filter((taxonomy) => taxonomy.ontologyId === ontologyId && taxonomy.versionId === versionId)
      .map(cloneTaxonomy)
      .toSorted((left, right) => left.taxonomyId.localeCompare(right.taxonomyId));
  }

  async listAllocations(
    ontologyId: string,
    versionId: string,
  ): Promise<OntologyAddressAllocationRecord[]> {
    return [...this.allocations.values()]
      .filter(
        (allocation) => allocation.ontologyId === ontologyId && allocation.versionId === versionId,
      )
      .map(cloneAllocation)
      .toSorted((left, right) => left.allocationId.localeCompare(right.allocationId));
  }

  async getAllocation(allocationId: string): Promise<OntologyAddressAllocationRecord | null> {
    const record = this.allocations.get(allocationId);
    return record ? cloneAllocation(record) : null;
  }

  async listSegments(allocationId: string): Promise<OntologyAddressSegmentRecord[]> {
    return [...this.segments.values()]
      .filter((segment) => segment.allocationId === allocationId)
      .map(cloneSegment)
      .toSorted(
        (left, right) =>
          left.addressOffset - right.addressOffset || left.segmentId.localeCompare(right.segmentId),
      );
  }

  async listActiveAllocations(): Promise<OntologyAddressAllocationRecord[]> {
    return [...this.allocations.values()]
      .filter((allocation) => allocation.status === "active")
      .map(cloneAllocation)
      .toSorted((left, right) => left.allocationId.localeCompare(right.allocationId));
  }

  private snapshot(): OntologyRegistryRecordSet {
    return {
      namespaces: [...this.namespaces.values()].map(cloneNamespace),
      axes: [...this.axes.values()].map(cloneAxis),
      taxonomies: [...this.taxonomies.values()].map(cloneTaxonomy),
      allocations: [...this.allocations.values()].map(cloneAllocation),
      segments: [...this.segments.values()].map(cloneSegment),
    };
  }
}

function axisKey(ontologyId: string, axisId: string, versionId: string): string {
  return `${ontologyId}\u0000${axisId}\u0000${versionId}`;
}

function taxonomyKey(ontologyId: string, taxonomyId: string, versionId: string): string {
  return `${ontologyId}\u0000${taxonomyId}\u0000${versionId}`;
}

function segmentKey(allocationId: string, segmentId: string): string {
  return `${allocationId}\u0000${segmentId}`;
}

function cloneNamespace(record: OntologyNamespaceRecord): OntologyNamespaceRecord {
  return { ...record };
}

function cloneAxis(record: OntologyAxisRecord): OntologyAxisRecord {
  return {
    ...record,
    values: [...record.values],
  };
}

function cloneTaxonomy(record: OntologyTaxonomyRecord): OntologyTaxonomyRecord {
  return {
    ...record,
    appliesTo: [...record.appliesTo],
    axisIds: [...record.axisIds],
    identityAxisIds: [...record.identityAxisIds],
  };
}

function cloneAllocation(record: OntologyAddressAllocationRecord): OntologyAddressAllocationRecord {
  return { ...record };
}

function cloneSegment(record: OntologyAddressSegmentRecord): OntologyAddressSegmentRecord {
  return {
    ...record,
    consumes: [...record.consumes],
  };
}
