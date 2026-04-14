export {
  type OntologyAddressModel,
  type OntologyAddressAllocationStatus,
  type OntologyNamespace,
  type OntologyAxisRegistration,
  type OntologyTaxonomyRegistration,
  type OntologyAddressAllocation,
  type OntologyAddressSegment,
  type OntologyAddressAllocationPolicy,
  type OntologyAddressAllocationIssue,
  type OntologyAddressAllocationIssueTarget,
  type OntologyAddressAllocationValidationResult,
  type OntologyAddressAllocationPlan,
  allocateOntologyAddressSpace,
  validateOntologyAddressAllocationPlan,
} from "./internal/ontology-allocation-core.js";

import {
  allocateOntologyAddressSpace,
  validateOntologyAddressAllocationPlan,
} from "./internal/ontology-allocation-core.js";

export const operationalOntologyAllocationPlane = {
  allocateOntologyAddressSpace,
  validateOntologyAddressAllocationPlan,
};
