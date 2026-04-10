import type {
  InformationFacetKind,
  TransmissionMedium,
  TransmissionSemantic,
} from "./runtime-core.js";

export interface DataFlowField {
  field: string;
  type: string;
  required: boolean;
  source?: string;
  schemaId?: string;
}

export const CORRIDOR_TEMPLATE_KINDS = [
  "pipe_graph",
  "event_record_observed",
] as const;

export type CorridorTemplateKind = (typeof CORRIDOR_TEMPLATE_KINDS)[number];

export const CORRIDOR_ENDPOINT_TEMPLATE_KINDS = [
  "port",
  "contract_field",
  "payload_root",
  "payload_field",
  "address_binding",
] as const;

export type CorridorEndpointTemplateKind =
  (typeof CORRIDOR_ENDPOINT_TEMPLATE_KINDS)[number];

export const CORRIDOR_CONTRACT_TEMPLATE_KINDS = [
  "pipe_contract",
  "event_record_contract",
  "address_binding_contract",
] as const;

export type CorridorContractTemplateKind =
  (typeof CORRIDOR_CONTRACT_TEMPLATE_KINDS)[number];

export const CORRIDOR_LINK_TEMPLATE_KINDS = [
  "pipe_connection",
  "lineage_link",
  "payload_projection",
  "observation_link",
] as const;

export type CorridorLinkTemplateKind =
  (typeof CORRIDOR_LINK_TEMPLATE_KINDS)[number];

export interface CorridorTemplate {
  kind: CorridorTemplateKind;
  description: string;
  allowedEndpointKinds?: readonly CorridorEndpointTemplateKind[];
  requiredEndpointKinds?: readonly CorridorEndpointTemplateKind[];
  allowedContractKinds?: readonly CorridorContractTemplateKind[];
  requiredContractKinds?: readonly CorridorContractTemplateKind[];
  allowedLinkKinds?: readonly CorridorLinkTemplateKind[];
  requiredLinkKinds?: readonly CorridorLinkTemplateKind[];
}

export interface CorridorTemplateRegistry {
  list(): CorridorTemplate[];
  get(kind: CorridorTemplateKind): CorridorTemplate | undefined;
}

export const DEFAULT_CORRIDOR_TEMPLATES = {
  pipe_graph: {
    kind: "pipe_graph",
    description:
      "Corridor materialized from PipeGraph and optional schema/lineage alignment",
    allowedEndpointKinds: ["port", "contract_field"],
    allowedContractKinds: ["pipe_contract"],
    allowedLinkKinds: ["pipe_connection", "lineage_link"],
  },
  event_record_observed: {
    kind: "event_record_observed",
    description:
      "Synthetic observed corridor materialized from EventRecord payload and address_context",
    allowedEndpointKinds: ["payload_root", "payload_field", "address_binding"],
    requiredEndpointKinds: ["payload_root"],
    allowedContractKinds: ["event_record_contract", "address_binding_contract"],
    requiredContractKinds: ["event_record_contract"],
    allowedLinkKinds: ["payload_projection", "observation_link"],
  },
} as const satisfies Record<CorridorTemplateKind, CorridorTemplate>;

export interface DataFlowEndpoint {
  endpointId: string;
  templateKind: CorridorEndpointTemplateKind;
  nodeId: string;
  direction: "in" | "out";
  facetKind: InformationFacetKind;
  portId?: string;
  field?: string;
  schemaId?: string;
  sourceKind: "port" | "contract";
}

export interface DataFlowContract {
  contractId: string;
  templateKind: CorridorContractTemplateKind;
  nodeId: string;
  consumes: DataFlowField[];
  produces: DataFlowField[];
  accesses?: Array<{
    schemaId: string;
    columns: string[];
    mode: "read" | "write" | "readwrite";
  }>;
}

export interface DataFlowLink {
  linkId: string;
  templateKind: CorridorLinkTemplateKind;
  fromEndpointId: string;
  toEndpointId: string;
  semantic: TransmissionSemantic;
  medium: TransmissionMedium;
  condition?: string;
  relationType?: string;
  sourceKind: "connection" | "lineage" | "payload";
}

export interface DataFlowDefinition {
  flowId: string;
  templateKind: CorridorTemplateKind;
  templateDescription?: string;
  templateValidation?: CorridorTemplateValidationResult;
  entryNodeId: string;
  nodeIds: string[];
  schemaIds: string[];
  endpoints: DataFlowEndpoint[];
  contracts: DataFlowContract[];
  links: DataFlowLink[];
}

export interface CorridorTemplateValidationResult {
  valid: boolean;
  missingEndpointKinds: CorridorEndpointTemplateKind[];
  disallowedEndpointKinds: CorridorEndpointTemplateKind[];
  missingContractKinds: CorridorContractTemplateKind[];
  disallowedContractKinds: CorridorContractTemplateKind[];
  missingLinkKinds: CorridorLinkTemplateKind[];
  disallowedLinkKinds: CorridorLinkTemplateKind[];
}

export type FlowCorridor = DataFlowDefinition;
export type CorridorEndpoint = DataFlowEndpoint;
export type CorridorContract = DataFlowContract;
export type CorridorLink = DataFlowLink;

export const defaultCorridorTemplateRegistry: CorridorTemplateRegistry = {
  list() {
    return Object.values(DEFAULT_CORRIDOR_TEMPLATES);
  },
  get(kind: CorridorTemplateKind) {
    return DEFAULT_CORRIDOR_TEMPLATES[kind];
  },
};

export function getCorridorTemplate(
  registry: CorridorTemplateRegistry,
  kind: CorridorTemplateKind,
): CorridorTemplate {
  const template = registry.get(kind);
  if (!template) {
    throw new Error(`Unknown corridor template "${kind}"`);
  }
  return template;
}

function validateKinds<K extends string>(
  seen: readonly K[],
  allowed: readonly K[] | undefined,
  required: readonly K[] | undefined,
): {
  missing: K[];
  disallowed: K[];
} {
  const seenSet = new Set<K>(seen);
  const missing = (required ?? []).filter((kind) => !seenSet.has(kind));
  const disallowed = allowed
    ? [...new Set(seen.filter((kind) => !new Set(allowed).has(kind)))]
    : [];

  return {
    missing: [...missing],
    disallowed,
  };
}

export function validateCorridorAgainstTemplate(
  corridor: DataFlowDefinition,
  registry: CorridorTemplateRegistry = defaultCorridorTemplateRegistry,
): CorridorTemplateValidationResult {
  const template = getCorridorTemplate(registry, corridor.templateKind);
  const endpointKinds = corridor.endpoints.map((endpoint) => endpoint.templateKind);
  const contractKinds = corridor.contracts.map((contract) => contract.templateKind);
  const linkKinds = corridor.links.map((link) => link.templateKind);

  const endpointValidation = validateKinds(
    endpointKinds,
    template.allowedEndpointKinds,
    template.requiredEndpointKinds,
  );
  const contractValidation = validateKinds(
    contractKinds,
    template.allowedContractKinds,
    template.requiredContractKinds,
  );
  const linkValidation = validateKinds(
    linkKinds,
    template.allowedLinkKinds,
    template.requiredLinkKinds,
  );

  return {
    valid:
      endpointValidation.missing.length === 0 &&
      endpointValidation.disallowed.length === 0 &&
      contractValidation.missing.length === 0 &&
      contractValidation.disallowed.length === 0 &&
      linkValidation.missing.length === 0 &&
      linkValidation.disallowed.length === 0,
    missingEndpointKinds: endpointValidation.missing,
    disallowedEndpointKinds: endpointValidation.disallowed,
    missingContractKinds: contractValidation.missing,
    disallowedContractKinds: contractValidation.disallowed,
    missingLinkKinds: linkValidation.missing,
    disallowedLinkKinds: linkValidation.disallowed,
  };
}
