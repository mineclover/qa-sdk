export {
  defaultCorridorTemplateRegistry,
  validateCorridorAgainstTemplate,
  type CorridorTemplateKind,
  CORRIDOR_TEMPLATE_KINDS,
  type CorridorEndpointTemplateKind,
  CORRIDOR_ENDPOINT_TEMPLATE_KINDS,
  type CorridorContractTemplateKind,
  CORRIDOR_CONTRACT_TEMPLATE_KINDS,
  type CorridorLinkTemplateKind,
  CORRIDOR_LINK_TEMPLATE_KINDS,
  type CorridorTemplate,
  type CorridorTemplateRegistry,
  DEFAULT_CORRIDOR_TEMPLATES,
  type DataFlowField,
  type DataFlowEndpoint,
  type DataFlowContract,
  type DataFlowLink,
  type DataFlowDefinition,
  type FlowCorridor,
  type CorridorEndpoint,
  type CorridorContract,
  type CorridorLink,
  type CorridorTemplateValidationResult,
} from './internal/corridor-core.js';

import {
  defaultCorridorTemplateRegistry,
  validateCorridorAgainstTemplate,
} from './internal/corridor-core.js';

export const operationalOntologyCorridorPlane = {
  defaultCorridorTemplateRegistry,
  validateCorridorAgainstTemplate,
};
