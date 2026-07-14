import type { DataSchema, FacetRole, PipeGraph } from '@qa-sdk/core';

import {
  defaultCorridorTemplateRegistry,
  getCorridorTemplate,
  validateCorridorAgainstTemplate,
  type CorridorTemplateRegistry,
  type DataFlowContract,
  type DataFlowDefinition,
  type DataFlowEndpoint,
  type DataFlowField,
  type DataFlowLink,
  type FlowCorridor,
} from './corridor-core.js';
import {
  defaultJunctionTemplateRegistry,
  getJunctionTemplate,
  validateJunctionAgainstTemplate,
  type BranchDefinition,
  type JunctionTemplateRegistry,
} from './junction-core.js';
import type { DataLineageLink } from './lineage-core.js';
import {
  inferLineageLinksFromPipe,
  normalizeContractFields,
  projectLineageToOperationalOntology,
} from './lineage-projector.js';
import type { PipeGraphProjectionInput, PipeGraphProjectionResult } from './projector-types.js';
import {
  buildPipeFieldSchemaHints,
  buildSchemaColumnIndex,
  createContractEndpointId,
  createPortEndpointId,
  mapFacetRoleToInformationFacetKind,
  parseSchemaColumnNodeId,
} from './projector-shared.js';
import {
  formatPipeConstraint,
  inferTransmissionDirection,
  inferTransmissionMedium,
  inferTransmissionSemantic,
  mapConnectionKindToControlFlowEdgeKind,
  mapPipeFlowKindToControlFlowNodeKind,
  normalizeFacetHint,
  normalizePipeEndpoint,
  resolvePipeFacetHint,
} from './projector-utils.js';
import {
  createInformationFacetRef,
  createSemanticTransmissionId,
  type ControlFlowEdge,
  type ControlFlowGraph,
  type ControlFlowNode,
  type SemanticTransmission,
} from './runtime-core.js';

function createPipeDataFlowContracts(
  graph: PipeGraph,
  pipeFieldSchemaHints: Map<
    string,
    { consumes: Map<string, Set<string>>; produces: Map<string, Set<string>> }
  >,
  corridorTemplateRegistry: CorridorTemplateRegistry = defaultCorridorTemplateRegistry,
): DataFlowContract[] {
  getCorridorTemplate(corridorTemplateRegistry, 'pipe_graph');
  return graph.pipes.flatMap((pipe) => {
    if (pipe.flow.kind !== 'step' || !pipe.flow.dataContract) {
      return [];
    }

    const schemaHints = pipeFieldSchemaHints.get(pipe.pipeId);

    return [
      {
        contractId: `contract:${pipe.pipeId}`,
        templateKind: 'pipe_contract',
        nodeId: pipe.pipeId,
        consumes: normalizeContractFields(pipe.flow.dataContract.consumes, schemaHints?.consumes),
        produces: normalizeContractFields(pipe.flow.dataContract.produces, schemaHints?.produces),
        accesses: pipe.flow.dataContract.accesses,
      },
    ];
  });
}

function createPipeDataFlowEndpoints(
  graph: PipeGraph,
  schemaColumnIndex: Map<string, { schema: DataSchema; column: string; facetRole?: FacetRole }>,
  pipeFieldSchemaHints: Map<
    string,
    { consumes: Map<string, Set<string>>; produces: Map<string, Set<string>> }
  >,
  corridorTemplateRegistry: CorridorTemplateRegistry = defaultCorridorTemplateRegistry,
): DataFlowEndpoint[] {
  getCorridorTemplate(corridorTemplateRegistry, 'pipe_graph');
  const endpoints: DataFlowEndpoint[] = [];

  for (const pipe of graph.pipes) {
    for (const port of pipe.ports ?? []) {
      endpoints.push({
        endpointId: createPortEndpointId(pipe.pipeId, port.portId),
        templateKind: 'port',
        nodeId: pipe.pipeId,
        direction: port.direction,
        facetKind: normalizeFacetHint(
          port.facetType,
          port.direction === 'out' ? 'production' : 'consumption',
        ),
        portId: port.portId,
        sourceKind: 'port',
      });
    }

    if (pipe.flow.kind !== 'step' || !pipe.flow.dataContract) {
      continue;
    }

    const schemaHints = pipeFieldSchemaHints.get(pipe.pipeId);
    for (const field of normalizeContractFields(
      pipe.flow.dataContract.consumes,
      schemaHints?.consumes,
    )) {
      endpoints.push({
        endpointId: createContractEndpointId(pipe.pipeId, 'in', field.field),
        templateKind: 'contract_field',
        nodeId: pipe.pipeId,
        direction: 'in',
        facetKind: mapFacetRoleToInformationFacetKind(
          field.schemaId
            ? schemaColumnIndex.get(`${field.schemaId}:${field.field}`)?.facetRole
            : undefined,
          'consumption',
        ),
        field: field.field,
        schemaId: field.schemaId,
        sourceKind: 'contract',
      });
    }

    for (const field of normalizeContractFields(
      pipe.flow.dataContract.produces,
      schemaHints?.produces,
    )) {
      endpoints.push({
        endpointId: createContractEndpointId(pipe.pipeId, 'out', field.field),
        templateKind: 'contract_field',
        nodeId: pipe.pipeId,
        direction: 'out',
        facetKind: mapFacetRoleToInformationFacetKind(
          field.schemaId
            ? schemaColumnIndex.get(`${field.schemaId}:${field.field}`)?.facetRole
            : undefined,
          'production',
        ),
        field: field.field,
        schemaId: field.schemaId,
        sourceKind: 'contract',
      });
    }
  }

  return [...new Map(endpoints.map((endpoint) => [endpoint.endpointId, endpoint])).values()];
}

function resolveEndpointId(
  endpointMap: Map<string, DataFlowEndpoint>,
  pipeId: string,
  direction: 'in' | 'out',
  portId?: string,
): string {
  if (portId) {
    const portEndpointId = createPortEndpointId(pipeId, portId);
    if (endpointMap.has(portEndpointId)) {
      return portEndpointId;
    }
  }

  const matching = [...endpointMap.values()].find(
    (endpoint) => endpoint.nodeId === pipeId && endpoint.direction === direction,
  );
  if (matching) {
    return matching.endpointId;
  }

  return createContractEndpointId(pipeId, direction, '_node');
}

function createPipeDataFlowLinks(
  graph: PipeGraph,
  endpointMap: Map<string, DataFlowEndpoint>,
  lineageLinks: DataLineageLink[],
  corridorTemplateRegistry: CorridorTemplateRegistry = defaultCorridorTemplateRegistry,
): DataFlowLink[] {
  getCorridorTemplate(corridorTemplateRegistry, 'pipe_graph');
  const links: DataFlowLink[] = [];

  for (const connection of graph.connections) {
    const fromEndpoints = normalizePipeEndpoint(connection.from);
    const toEndpoints = normalizePipeEndpoint(connection.to);

    for (const fromEndpoint of fromEndpoints) {
      for (const toEndpoint of toEndpoints) {
        const sourcePipe = graph.pipes.find((pipe) => pipe.pipeId === fromEndpoint.pipeId);
        const targetPipe = graph.pipes.find((pipe) => pipe.pipeId === toEndpoint.pipeId);
        const sourceFacet = normalizeFacetHint(
          resolvePipeFacetHint(sourcePipe, fromEndpoint, 'out') ?? connection.facetType,
          'production',
        );
        const targetFacet = normalizeFacetHint(
          resolvePipeFacetHint(targetPipe, toEndpoint, 'in') ?? connection.facetType,
          'consumption',
        );

        links.push({
          linkId: `flow-link:${fromEndpoint.pipeId}:${connection.kind}:${toEndpoint.pipeId}:${connection.condition ?? ''}`,
          templateKind: 'pipe_connection',
          fromEndpointId: resolveEndpointId(
            endpointMap,
            fromEndpoint.pipeId,
            'out',
            fromEndpoint.portId,
          ),
          toEndpointId: resolveEndpointId(endpointMap, toEndpoint.pipeId, 'in', toEndpoint.portId),
          semantic: inferTransmissionSemantic(connection.kind, sourceFacet, targetFacet),
          medium: inferTransmissionMedium(connection.kind, sourceFacet, targetFacet),
          condition: connection.condition,
          relationType: `pipe_connection:${connection.kind}`,
          sourceKind: 'connection',
        });
      }
    }
  }

  for (const lineage of lineageLinks) {
    for (const source of lineage.sources) {
      const sourceField = parseSchemaColumnNodeId(source.nodeId)?.column;
      const targetField = parseSchemaColumnNodeId(lineage.target.nodeId)?.column;
      const pipeId = lineage.transmissionRef;

      links.push({
        linkId: `flow-link:lineage:${source.key}->${lineage.target.key}`,
        templateKind: 'lineage_link',
        fromEndpointId:
          pipeId && sourceField
            ? createContractEndpointId(pipeId, 'in', sourceField)
            : source.nodeId,
        toEndpointId:
          pipeId && targetField
            ? createContractEndpointId(pipeId, 'out', targetField)
            : lineage.target.nodeId,
        semantic: 'production_to_consumption',
        medium: 'direct',
        relationType: 'lineage',
        sourceKind: 'lineage',
      });
    }
  }

  return [...new Map(links.map((link) => [link.linkId, link])).values()];
}

function extractBranchDefinitions(
  graph: PipeGraph,
  junctionTemplateRegistry: JunctionTemplateRegistry = defaultJunctionTemplateRegistry,
): BranchDefinition[] {
  const junctionTemplate = getJunctionTemplate(junctionTemplateRegistry, 'conditional_branch');
  const connectionsBySource = new Map<string, PipeGraph['connections']>();

  for (const connection of graph.connections) {
    const fromEndpoints = normalizePipeEndpoint(connection.from);
    for (const endpoint of fromEndpoints) {
      const current = connectionsBySource.get(endpoint.pipeId) ?? [];
      current.push(connection);
      connectionsBySource.set(endpoint.pipeId, current);
    }
  }

  const branchDefinitions: BranchDefinition[] = [];

  for (const [branchNodeId, connections] of connectionsBySource) {
    const conditionalConnections = connections.filter(
      (connection) => connection.kind === 'conditional',
    );
    if (conditionalConnections.length === 0) {
      continue;
    }

    const paths = connections.flatMap((connection, index) => {
      const toEndpoints = normalizePipeEndpoint(connection.to);
      if (toEndpoints.length === 0) {
        return [];
      }

      return [
        {
          pathId: `${branchNodeId}->${toEndpoints
            .map((endpoint) => endpoint.pipeId)
            .join('+')}:${index}`,
          when: connection.condition
            ? {
                conditionId: `${branchNodeId}:condition:${index}`,
                expression: connection.condition,
              }
            : undefined,
          nextNodeIds: toEndpoints.map((endpoint) => endpoint.pipeId),
          priority: index,
        },
      ];
    });

    branchDefinitions.push({
      templateKind: 'conditional_branch',
      templateDescription: junctionTemplate.description,
      templateValidation: validateJunctionAgainstTemplate('first_match', junctionTemplate, paths),
      branchNodeId,
      mode: 'first_match',
      paths,
    });
  }

  return branchDefinitions;
}

function createPipeEntryCondition(pipe: PipeGraph['pipes'][number]): string | undefined {
  const triggerCondition = `event:${pipe.trigger.eventKey}`;
  const entryConditions = pipe.trigger.entryConditions?.map(formatPipeConstraint) ?? [];

  if (entryConditions.length === 0) {
    return triggerCondition;
  }

  return `${triggerCondition} && ${entryConditions.join(' && ')}`;
}

function createPipeExitCondition(pipe: PipeGraph['pipes'][number]): string | undefined {
  const flow = pipe.flow;

  switch (flow.kind) {
    case 'branch':
    case 'await':
    case 'filter':
      return flow.condition;
    case 'loop':
    case 'feedback':
      return flow.until;
    case 'correlation':
      return `response:${flow.responseEvent}`;
    default:
      return pipe.produces && pipe.produces.length > 0
        ? `emit:${pipe.produces.join(',')}`
        : undefined;
  }
}

export function projectPipeGraphToOperationalOntology(
  input: PipeGraphProjectionInput,
): PipeGraphProjectionResult {
  const { graph } = input;
  const corridorTemplate = getCorridorTemplate(
    input.corridorTemplateRegistry ?? defaultCorridorTemplateRegistry,
    'pipe_graph',
  );
  const pipesById = new Map(graph.pipes.map((pipe) => [pipe.pipeId, pipe]));
  const schemaColumnIndex = buildSchemaColumnIndex(input.schemas);
  const pipeFieldSchemaHints = buildPipeFieldSchemaHints(input.lineages);
  const branchDefinitions = extractBranchDefinitions(graph, input.junctionTemplateRegistry);
  const lineageLinks =
    input.lineages && input.lineages.length > 0
      ? projectLineageToOperationalOntology({
          schemas: input.schemas,
          lineages: input.lineages,
        })
      : graph.pipes.flatMap((pipe) => inferLineageLinksFromPipe(pipe));
  const dataFlowContracts = createPipeDataFlowContracts(
    graph,
    pipeFieldSchemaHints,
    input.corridorTemplateRegistry,
  );
  const dataFlowEndpoints = createPipeDataFlowEndpoints(
    graph,
    schemaColumnIndex,
    pipeFieldSchemaHints,
    input.corridorTemplateRegistry,
  );
  const dataFlowEndpointMap = new Map(
    dataFlowEndpoints.map((endpoint) => [endpoint.endpointId, endpoint]),
  );
  const dataFlowLinks = createPipeDataFlowLinks(
    graph,
    dataFlowEndpointMap,
    lineageLinks,
    input.corridorTemplateRegistry,
  );
  const controlFlowNodes: ControlFlowNode[] = graph.pipes.map((pipe) => ({
    nodeId: pipe.pipeId,
    kind: mapPipeFlowKindToControlFlowNodeKind(pipe.flow.kind),
    facet:
      pipe.flow.kind === 'step' ? normalizeFacetHint(pipe.flow.facet, 'production') : undefined,
    entryCondition: createPipeEntryCondition(pipe),
    exitCondition: createPipeExitCondition(pipe),
    sourceKind: pipe.flow.kind,
  }));

  const controlFlowEdges: ControlFlowEdge[] = [];
  const transmissions = new Map<string, SemanticTransmission>();
  const edgeSet = new Set<string>();

  for (const connection of graph.connections) {
    const fromEndpoints = normalizePipeEndpoint(connection.from);
    const toEndpoints = normalizePipeEndpoint(connection.to);

    for (const fromEndpoint of fromEndpoints) {
      for (const toEndpoint of toEndpoints) {
        const edgeKey = `${fromEndpoint.pipeId}:${connection.kind}:${toEndpoint.pipeId}:${connection.condition ?? ''}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          controlFlowEdges.push({
            from: fromEndpoint.pipeId,
            to: toEndpoint.pipeId,
            kind: mapConnectionKindToControlFlowEdgeKind(connection.kind),
            condition: connection.condition,
            sourceKind: connection.kind,
          });
        }

        const sourcePipe = pipesById.get(fromEndpoint.pipeId);
        const targetPipe = pipesById.get(toEndpoint.pipeId);
        const sourceFacet = normalizeFacetHint(
          resolvePipeFacetHint(sourcePipe, fromEndpoint, 'out') ?? connection.facetType,
          'production',
        );
        const targetFacet = normalizeFacetHint(
          resolvePipeFacetHint(targetPipe, toEndpoint, 'in') ?? connection.facetType,
          'consumption',
        );
        const source = createInformationFacetRef({
          nodeId: fromEndpoint.pipeId,
          facetKind: sourceFacet,
        });
        const target = createInformationFacetRef({
          nodeId: toEndpoint.pipeId,
          facetKind: targetFacet,
        });
        const semantic = inferTransmissionSemantic(connection.kind, sourceFacet, targetFacet);
        transmissions.set(
          createSemanticTransmissionId({
            source,
            target,
            semantic,
          }),
          {
            transmissionId: createSemanticTransmissionId({
              source,
              target,
              semantic,
            }),
            source,
            target,
            semantic,
            medium: inferTransmissionMedium(connection.kind, sourceFacet, targetFacet),
            direction: inferTransmissionDirection(connection.kind),
            relationType: `pipe_connection:${connection.kind}`,
            contractRefs: connection.condition ? [connection.condition] : undefined,
          },
        );
      }
    }
  }

  const corridor: FlowCorridor = {
    flowId: graph.graphId,
    templateKind: 'pipe_graph',
    templateDescription: corridorTemplate.description,
    entryNodeId: graph.entryPipeId,
    nodeIds: graph.pipes.map((pipe) => pipe.pipeId),
    schemaIds: [...new Set((input.schemas ?? []).map((schema) => schema.schemaId))],
    endpoints: dataFlowEndpoints,
    contracts: dataFlowContracts,
    links: dataFlowLinks,
  };
  const validatedCorridor: FlowCorridor = {
    ...corridor,
    templateValidation: validateCorridorAgainstTemplate(
      corridor,
      input.corridorTemplateRegistry ?? defaultCorridorTemplateRegistry,
    ),
  };

  return {
    controlFlow: {
      graphId: graph.graphId,
      entryNodeId: graph.entryPipeId,
      nodes: controlFlowNodes,
      edges: controlFlowEdges,
      version: graph.version,
      description: graph.description,
    },
    dataFlow: validatedCorridor,
    corridor: validatedCorridor,
    transmissions: [...transmissions.values()],
    lineageLinks,
    branchDefinitions,
    junctions: branchDefinitions,
  };
}
