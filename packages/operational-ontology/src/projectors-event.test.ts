import { describe, expect, it } from 'vitest';
import type { EventRecord } from '@qa-sdk/core';

import {
  type CheckpointTemplateRegistry,
  type CorridorTemplateRegistry,
  projectEventRecordToOperationalOntology,
} from './index.js';

describe('projectEventRecordToOperationalOntology', () => {
  it('projects address_context bindings into observation transmissions', () => {
    const record: EventRecord = {
      log_id: 'log-1',
      timestamp: '2026-04-09T00:00:00.000Z',
      record_kind: 'log',
      trace_id: 'trace-1',
      span_id: 'span-1',
      event_key: 'order.submit',
      event_version: 'v1',
      payload_format: 'json',
      payload_encoding: 'identity',
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: {
        orderId: 'ord_1',
        amount: 42,
      },
      address_context: {
        order_event: 'order_event:v1:5',
      },
    };

    const result = projectEventRecordToOperationalOntology({ record });

    expect(result.observedNodeKeys).toContain('event-record:log-1');
    expect(result.dataFlow).toMatchObject({
      flowId: 'event-record:log-1',
      templateKind: 'event_record_observed',
      entryNodeId: 'event-record:log-1',
      nodeIds: ['event-record:log-1', 'address-context:order_event:order_event:v1:5'],
      schemaIds: [],
    });
    expect(result.dataFlow.templateValidation?.valid).toBe(true);
    expect(result.dataFlow.endpoints).toEqual([
      {
        endpointId: 'endpoint:event-record:log-1:out:payload',
        templateKind: 'payload_root',
        nodeId: 'event-record:log-1',
        direction: 'out',
        facetKind: 'production',
        field: 'payload',
        sourceKind: 'contract',
      },
      {
        endpointId: 'endpoint:event-record:log-1:out:orderId',
        templateKind: 'payload_field',
        nodeId: 'event-record:log-1',
        direction: 'out',
        facetKind: 'production',
        field: 'orderId',
        sourceKind: 'contract',
      },
      {
        endpointId: 'endpoint:event-record:log-1:out:amount',
        templateKind: 'payload_field',
        nodeId: 'event-record:log-1',
        direction: 'out',
        facetKind: 'production',
        field: 'amount',
        sourceKind: 'contract',
      },
      {
        endpointId: 'endpoint:address-context:order_event:order_event:v1:5:in:order_event',
        templateKind: 'address_binding',
        nodeId: 'address-context:order_event:order_event:v1:5',
        direction: 'in',
        facetKind: 'consumption',
        field: 'order_event',
        sourceKind: 'contract',
      },
    ]);
    expect(result.dataFlow.links).toEqual([
      {
        linkId: 'flow-link:event-record:log-1:payload:orderId:0',
        templateKind: 'payload_projection',
        fromEndpointId: 'endpoint:event-record:log-1:out:payload',
        toEndpointId: 'endpoint:event-record:log-1:out:orderId',
        semantic: 'production_to_consumption',
        medium: 'direct',
        relationType: 'payload_field',
        sourceKind: 'payload',
      },
      {
        linkId: 'flow-link:event-record:log-1:payload:amount:1',
        templateKind: 'payload_projection',
        fromEndpointId: 'endpoint:event-record:log-1:out:payload',
        toEndpointId: 'endpoint:event-record:log-1:out:amount',
        semantic: 'production_to_consumption',
        medium: 'direct',
        relationType: 'payload_field',
        sourceKind: 'payload',
      },
      {
        linkId: 'flow-link:event-record:log-1:order_event:0',
        templateKind: 'observation_link',
        fromEndpointId: 'endpoint:event-record:log-1:out:payload',
        toEndpointId: 'endpoint:address-context:order_event:order_event:v1:5:in:order_event',
        semantic: 'observation_emission',
        medium: 'observation',
        relationType: 'observes_address_context',
        sourceKind: 'connection',
      },
    ]);
    expect(result.transmissions).toHaveLength(1);
    expect(result.transmissions[0]).toMatchObject({
      semantic: 'observation_emission',
      medium: 'observation',
      relationType: 'observes_address_context',
    });
    expect(result.checkpoint).toMatchObject({
      checkpointId: 'checkpoint:event-record:log-1',
      templateKind: 'root',
      recordId: 'log-1',
      traceId: 'trace-1',
      eventKey: 'order.submit',
      timestamp: '2026-04-09T00:00:00.000Z',
      corridorId: 'event-record:log-1',
    });
    expect(result.checkpointDefinitions).toHaveLength(4);
    expect(result.checkpointDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkpointId: 'checkpoint:event-record:log-1',
          templateKind: 'root',
          nodeId: 'event-record:log-1',
          observedPrefixIds: ['order_event'],
          observedFields: ['orderId', 'amount'],
          templateValidation: {
            valid: true,
            missingObservedFields: false,
            missingObservedPrefixIds: false,
            nodeNotObserved: false,
          },
        }),
        expect.objectContaining({
          checkpointId: 'checkpoint:event-record:log-1:payload:orderId',
          templateKind: 'payload_field',
          nodeId: 'event-record:log-1',
          observedPrefixIds: [],
          observedFields: ['orderId'],
        }),
        expect.objectContaining({
          checkpointId: 'checkpoint:event-record:log-1:payload:amount',
          templateKind: 'payload_field',
          nodeId: 'event-record:log-1',
          observedPrefixIds: [],
          observedFields: ['amount'],
        }),
        expect.objectContaining({
          checkpointId: 'checkpoint:event-record:log-1:binding:order_event:0',
          templateKind: 'address_binding',
          nodeId: 'address-context:order_event:order_event:v1:5',
          observedPrefixIds: ['order_event'],
          observedFields: [],
        }),
      ]),
    );
    expect(result.checkpoints).toHaveLength(4);
    expect(result.checkpointLattice).toMatchObject({
      corridorId: 'event-record:log-1',
      rootCheckpointId: 'checkpoint:event-record:log-1',
    });
    expect(result.checkpointLattice.links).toEqual([
      {
        fromCheckpointId: 'checkpoint:event-record:log-1',
        toCheckpointId: 'checkpoint:event-record:log-1:payload:orderId',
        relation: 'contains',
      },
      {
        fromCheckpointId: 'checkpoint:event-record:log-1',
        toCheckpointId: 'checkpoint:event-record:log-1:payload:amount',
        relation: 'contains',
      },
      {
        fromCheckpointId: 'checkpoint:event-record:log-1',
        toCheckpointId: 'checkpoint:event-record:log-1:binding:order_event:0',
        relation: 'contains',
      },
    ]);
    expect(result.checkpoint.dataFlow).toEqual(result.dataFlow);
    expect(result.dataFlow.contracts).toEqual([
      {
        contractId: 'contract:event-record:log-1',
        templateKind: 'event_record_contract',
        nodeId: 'event-record:log-1',
        consumes: [],
        produces: [
          {
            field: 'payload',
            type: 'object:json',
            required: true,
            source: 'order.submit',
          },
          {
            field: 'orderId',
            type: 'string',
            required: true,
            source: 'order.submit',
          },
          {
            field: 'amount',
            type: 'number',
            required: true,
            source: 'order.submit',
          },
        ],
      },
      {
        contractId: 'contract:address-context:order_event:order_event:v1:5',
        templateKind: 'address_binding_contract',
        nodeId: 'address-context:order_event:order_event:v1:5',
        consumes: [
          {
            field: 'order_event',
            type: 'address_context_binding',
            required: true,
            source: 'order.submit',
          },
        ],
        produces: [],
      },
    ]);
  });

  it('materializes checkpoint lattice through the provided checkpoint template registry', () => {
    const record: EventRecord = {
      log_id: 'log-2',
      timestamp: '2026-04-09T00:00:00.000Z',
      record_kind: 'log',
      trace_id: 'trace-2',
      span_id: 'span-2',
      event_key: 'order.submit',
      event_version: 'v1',
      payload_format: 'json',
      payload_encoding: 'identity',
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: 'ord_2' },
      address_context: {},
    };

    const customRegistry: CheckpointTemplateRegistry = {
      list() {
        return [
          { kind: 'root', description: 'root' },
          {
            kind: 'payload_field',
            relationToParent: 'observes',
            description: 'payload',
            requireObservedPrefixIds: true,
          },
          { kind: 'address_binding', relationToParent: 'contains', description: 'binding' },
          { kind: 'route_decision', relationToParent: 'decides', description: 'route' },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectEventRecordToOperationalOntology({
      record,
      checkpointTemplateRegistry: customRegistry,
    });

    expect(result.checkpointLattice.links).toContainEqual({
      fromCheckpointId: 'checkpoint:event-record:log-2',
      toCheckpointId: 'checkpoint:event-record:log-2:payload:orderId',
      relation: 'observes',
    });
    expect(result.checkpointDefinitions).toContainEqual(
      expect.objectContaining({
        checkpointId: 'checkpoint:event-record:log-2:payload:orderId',
        templateValidation: {
          valid: false,
          missingObservedFields: false,
          missingObservedPrefixIds: true,
          nodeNotObserved: false,
        },
      }),
    );
  });

  it('materializes event corridor metadata through the provided corridor template registry', () => {
    const record: EventRecord = {
      log_id: 'log-3',
      timestamp: '2026-04-09T00:00:00.000Z',
      record_kind: 'log',
      trace_id: 'trace-3',
      span_id: 'span-3',
      event_key: 'order.submit',
      event_version: 'v1',
      payload_format: 'json',
      payload_encoding: 'identity',
      payload_masking_applied: false,
      payload_masked_fields: [],
      payload: { orderId: 'ord_3' },
      address_context: {},
    };

    const customRegistry: CorridorTemplateRegistry = {
      list() {
        return [
          {
            kind: 'pipe_graph',
            description: 'Custom pipe corridor',
          },
          {
            kind: 'event_record_observed',
            description: 'Custom event corridor',
            allowedEndpointKinds: ['payload_root', 'payload_field'],
            requiredEndpointKinds: ['payload_root'],
            allowedContractKinds: ['event_record_contract'],
            requiredContractKinds: ['event_record_contract'],
            allowedLinkKinds: ['payload_projection'],
          },
        ];
      },
      get(kind) {
        return this.list().find((template) => template.kind === kind);
      },
    };

    const result = projectEventRecordToOperationalOntology({
      record,
      corridorTemplateRegistry: customRegistry,
    });

    expect(result.dataFlow.templateDescription).toBe('Custom event corridor');
    expect(result.checkpoint.dataFlow.templateDescription).toBe('Custom event corridor');
    expect(result.dataFlow.templateValidation).toEqual({
      valid: true,
      missingEndpointKinds: [],
      disallowedEndpointKinds: [],
      missingContractKinds: [],
      disallowedContractKinds: [],
      missingLinkKinds: [],
      disallowedLinkKinds: [],
    });
  });
});
