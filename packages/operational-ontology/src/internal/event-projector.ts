import type { EventRecord } from '@qa-sdk/core';

import {
  createCheckpointDefinitionFromTemplate,
  createCheckpointLinkFromTemplate,
  createCheckpointObservationFromTemplate,
  defaultCheckpointTemplateRegistry,
  type AddressContextBinding,
  type CheckpointDefinition,
  type CheckpointLattice,
  type CheckpointObservation,
  type CheckpointTemplateRegistry,
} from './checkpoint-core.js';
import {
  defaultCorridorTemplateRegistry,
  getCorridorTemplate,
  validateCorridorAgainstTemplate,
  type CorridorTemplateRegistry,
  type DataFlowDefinition,
  type DataFlowEndpoint,
  type DataFlowLink,
  type FlowCorridor,
} from './corridor-core.js';
import type {
  EventRecordObservationInput,
  EventRecordProjectionResult,
} from './projector-types.js';
import { createContractEndpointId } from './projector-shared.js';
import { extractPayloadFields, inferPayloadType } from './projector-utils.js';
import {
  createEdgeCanonicalKey,
  createInformationFacetRef,
  createSemanticTransmissionId,
  type SemanticTransmission,
} from './runtime-core.js';

function createEventRecordDataFlow(
  record: EventRecord,
  bindings: readonly AddressContextBinding[],
  corridorTemplateRegistry: CorridorTemplateRegistry = defaultCorridorTemplateRegistry,
): DataFlowDefinition {
  const corridorTemplate = getCorridorTemplate(corridorTemplateRegistry, 'event_record_observed');
  const recordNodeId = `event-record:${record.log_id}`;
  const sourceEndpointId = createContractEndpointId(recordNodeId, 'out', 'payload');
  const payloadFields = extractPayloadFields(record.payload);
  const payloadFieldEndpoints: DataFlowEndpoint[] = payloadFields.map((field) => ({
    endpointId: createContractEndpointId(recordNodeId, 'out', field.field),
    templateKind: 'payload_field',
    nodeId: recordNodeId,
    direction: 'out',
    facetKind: 'production',
    field: field.field,
    sourceKind: 'contract',
  }));
  const bindingEndpoints: DataFlowEndpoint[] = bindings.map((binding) => {
    const targetNodeId =
      binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;

    return {
      endpointId: createContractEndpointId(targetNodeId, 'in', binding.prefixId),
      templateKind: 'address_binding',
      nodeId: targetNodeId,
      direction: 'in',
      facetKind: 'consumption',
      field: binding.prefixId,
      sourceKind: 'contract',
    };
  });

  const links: DataFlowLink[] = [
    ...payloadFields.map((field, index) => ({
      linkId: `flow-link:event-record:${record.log_id}:payload:${field.field}:${index}`,
      templateKind: 'payload_projection' as const,
      fromEndpointId: sourceEndpointId,
      toEndpointId: createContractEndpointId(recordNodeId, 'out', field.field),
      semantic: 'production_to_consumption' as const,
      medium: 'direct' as const,
      relationType: 'payload_field',
      sourceKind: 'payload' as const,
    })),
    ...bindings.map((binding, index) => {
      const targetNodeId =
        binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;

      return {
        linkId: `flow-link:event-record:${record.log_id}:${binding.prefixId}:${index}`,
        templateKind: 'observation_link' as const,
        fromEndpointId: sourceEndpointId,
        toEndpointId: createContractEndpointId(targetNodeId, 'in', binding.prefixId),
        semantic: 'observation_emission' as const,
        medium: 'observation' as const,
        relationType: 'observes_address_context',
        sourceKind: 'connection' as const,
      };
    }),
  ];

  const corridor: DataFlowDefinition = {
    flowId: `event-record:${record.log_id}`,
    templateKind: 'event_record_observed',
    templateDescription: corridorTemplate.description,
    entryNodeId: recordNodeId,
    nodeIds: [
      recordNodeId,
      ...bindings.map(
        (binding) =>
          binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`,
      ),
    ],
    schemaIds: [],
    endpoints: [
      {
        endpointId: sourceEndpointId,
        templateKind: 'payload_root',
        nodeId: recordNodeId,
        direction: 'out',
        facetKind: 'production',
        field: 'payload',
        sourceKind: 'contract',
      },
      ...payloadFieldEndpoints,
      ...bindingEndpoints,
    ],
    contracts: [
      {
        contractId: `contract:${recordNodeId}`,
        templateKind: 'event_record_contract' as const,
        nodeId: recordNodeId,
        consumes: [],
        produces: [
          {
            field: 'payload',
            type: inferPayloadType(record),
            required: true,
            source: record.event_key,
          },
          ...payloadFields.map((field) => ({
            field: field.field,
            type: field.type,
            required: field.required,
            source: record.event_key,
          })),
        ],
      },
      ...bindings.map((binding) => {
        const targetNodeId =
          binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;
        return {
          contractId: `contract:${targetNodeId}`,
          templateKind: 'address_binding_contract' as const,
          nodeId: targetNodeId,
          consumes: [
            {
              field: binding.prefixId,
              type: 'address_context_binding',
              required: true,
              source: record.event_key,
            },
          ],
          produces: [],
        };
      }),
    ],
    links,
  };

  return {
    ...corridor,
    templateValidation: validateCorridorAgainstTemplate(corridor, corridorTemplateRegistry),
  };
}

function createEventRecordCheckpointLattice(
  record: EventRecord,
  bindings: readonly AddressContextBinding[],
  dataFlow: FlowCorridor,
  observedNodeKeys: readonly string[],
  observedEdgeKeys: readonly string[],
  transmissions: readonly SemanticTransmission[],
  checkpointTemplateRegistry: CheckpointTemplateRegistry = defaultCheckpointTemplateRegistry,
): {
  root: CheckpointObservation;
  definitions: CheckpointDefinition[];
  observations: CheckpointObservation[];
  lattice: CheckpointLattice;
} {
  const recordNodeId = `event-record:${record.log_id}`;
  const rootCheckpointId = `checkpoint:event-record:${record.log_id}`;
  const payloadFields = extractPayloadFields(record.payload).map((field) => field.field);

  const rootDefinition = createCheckpointDefinitionFromTemplate(checkpointTemplateRegistry, {
    checkpointId: rootCheckpointId,
    templateKind: 'root',
    nodeId: recordNodeId,
    observedPrefixIds: bindings.map((binding) => binding.prefixId),
    observedFields: payloadFields,
  });

  const rootObservation = createCheckpointObservationFromTemplate(checkpointTemplateRegistry, {
    checkpointId: rootCheckpointId,
    templateKind: 'root',
    nodeId: recordNodeId,
    observedPrefixIds: bindings.map((binding) => binding.prefixId),
    observedFields: payloadFields,
    recordId: record.log_id,
    traceId: record.trace_id,
    eventKey: record.event_key,
    timestamp: record.timestamp,
    corridorId: dataFlow.flowId,
    observedNodeKeys: [...observedNodeKeys],
    observedEdgeKeys: [...observedEdgeKeys],
    transmissions: [...transmissions],
    dataFlow,
  });

  const payloadDefinitions = payloadFields.map((field) =>
    createCheckpointDefinitionFromTemplate(checkpointTemplateRegistry, {
      checkpointId: `${rootCheckpointId}:payload:${field}`,
      templateKind: 'payload_field',
      nodeId: recordNodeId,
      observedPrefixIds: [],
      observedFields: [field],
    }),
  );

  const payloadObservations = payloadFields.map((field) =>
    createCheckpointObservationFromTemplate(checkpointTemplateRegistry, {
      checkpointId: `${rootCheckpointId}:payload:${field}`,
      templateKind: 'payload_field',
      nodeId: recordNodeId,
      observedFields: [field],
      recordId: record.log_id,
      traceId: record.trace_id,
      eventKey: record.event_key,
      timestamp: record.timestamp,
      corridorId: dataFlow.flowId,
      observedNodeKeys: [recordNodeId],
      observedEdgeKeys: [`edge:${recordNodeId}->payload_field->${recordNodeId}:${field}`],
      transmissions: [],
      dataFlow,
    }),
  );

  const bindingDefinitions = bindings.map((binding, index) => {
    const targetNodeId =
      binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;
    return createCheckpointDefinitionFromTemplate(checkpointTemplateRegistry, {
      checkpointId: `${rootCheckpointId}:binding:${binding.prefixId}:${index}`,
      templateKind: 'address_binding',
      nodeId: targetNodeId,
      observedPrefixIds: [binding.prefixId],
      observedFields: [],
    });
  });

  const bindingObservations = bindings.map((binding, index) => {
    const targetNodeId =
      binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;
    return createCheckpointObservationFromTemplate(checkpointTemplateRegistry, {
      checkpointId: `${rootCheckpointId}:binding:${binding.prefixId}:${index}`,
      templateKind: 'address_binding',
      nodeId: targetNodeId,
      observedPrefixIds: [binding.prefixId],
      recordId: record.log_id,
      traceId: record.trace_id,
      eventKey: record.event_key,
      timestamp: record.timestamp,
      corridorId: dataFlow.flowId,
      observedNodeKeys: [recordNodeId, targetNodeId],
      observedEdgeKeys: [
        createEdgeCanonicalKey({
          start: recordNodeId,
          relationType: 'observes_address_context',
          end: targetNodeId,
        }),
      ],
      transmissions: transmissions.filter((transmission) =>
        transmission.contractRefs?.includes(binding.prefixId),
      ),
      dataFlow,
    });
  });

  const definitions = [rootDefinition, ...payloadDefinitions, ...bindingDefinitions];
  const observations = [rootObservation, ...payloadObservations, ...bindingObservations];
  const links = [
    ...payloadDefinitions.map((definition) =>
      createCheckpointLinkFromTemplate(checkpointTemplateRegistry, {
        parentCheckpointId: rootCheckpointId,
        childCheckpointId: definition.checkpointId,
        childTemplateKind: definition.templateKind,
      }),
    ),
    ...bindingDefinitions.map((definition) =>
      createCheckpointLinkFromTemplate(checkpointTemplateRegistry, {
        parentCheckpointId: rootCheckpointId,
        childCheckpointId: definition.checkpointId,
        childTemplateKind: definition.templateKind,
      }),
    ),
  ];

  return {
    root: rootObservation,
    definitions,
    observations,
    lattice: {
      corridorId: dataFlow.flowId,
      rootCheckpointId,
      definitions,
      observations,
      links,
    },
  };
}

export function projectEventRecordToOperationalOntology(
  input: EventRecordObservationInput,
): EventRecordProjectionResult {
  const bindings: AddressContextBinding[] =
    input.addressBindings ??
    Object.entries(input.record.address_context ?? {}).map(([prefixId, address]) => ({
      prefixId,
      address,
    }));

  const recordNodeId = `event-record:${input.record.log_id}`;
  const source = createInformationFacetRef({
    nodeId: recordNodeId,
    facetKind: 'production',
  });

  const observedNodeKeys = new Set<string>([recordNodeId]);
  const observedEdgeKeys = new Set<string>();
  const transmissions: SemanticTransmission[] = [];

  for (const binding of bindings) {
    const targetNodeId =
      binding.canonicalKey ?? `address-context:${binding.prefixId}:${binding.address}`;
    observedNodeKeys.add(targetNodeId);
    observedEdgeKeys.add(
      createEdgeCanonicalKey({
        start: recordNodeId,
        relationType: 'observes_address_context',
        end: targetNodeId,
      }),
    );

    const target = createInformationFacetRef({
      nodeId: targetNodeId,
      facetKind: 'consumption',
    });

    transmissions.push({
      transmissionId: createSemanticTransmissionId({
        source,
        target,
        semantic: 'observation_emission',
      }),
      source,
      target,
      semantic: 'observation_emission',
      medium: 'observation',
      direction: 'forward',
      relationType: 'observes_address_context',
      contractRefs: [binding.prefixId],
    });
  }

  const dataFlow = createEventRecordDataFlow(
    input.record,
    bindings,
    input.corridorTemplateRegistry,
  );
  const checkpointProjection = createEventRecordCheckpointLattice(
    input.record,
    bindings,
    dataFlow,
    [...observedNodeKeys],
    [...observedEdgeKeys],
    transmissions,
    input.checkpointTemplateRegistry,
  );

  return {
    observedNodeKeys: [...observedNodeKeys],
    observedEdgeKeys: [...observedEdgeKeys],
    dataFlow,
    transmissions,
    checkpoint: checkpointProjection.root,
    checkpoints: checkpointProjection.observations,
    checkpointDefinitions: checkpointProjection.definitions,
    checkpointLattice: checkpointProjection.lattice,
  };
}
