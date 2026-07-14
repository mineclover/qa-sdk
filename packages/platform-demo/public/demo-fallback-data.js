// Static read-model for public demo pages when registry/ingest services are unavailable.
(function () {
  'use strict';

  var axes = [
    { id: 'env', version: '1', entries: 5, capacity: 32 },
    { id: 'region', version: '1', entries: 2, capacity: 32 },
    { id: 'service', version: '1', entries: 16, capacity: 32 },
    { id: 'namespace', version: '1', entries: 2, capacity: 32 },
    { id: 'event_kind', version: '1', entries: 9, capacity: 32 },
    { id: 'flow_phase', version: '1', entries: 6, capacity: 16 },
    { id: 'actor', version: '1', entries: 5, capacity: 16 },
    { id: 'resource', version: '1', entries: 8, capacity: 32 },
    { id: 'lifecycle_state', version: '1', entries: 7, capacity: 16 },
    { id: 'quality_signal', version: '1', entries: 6, capacity: 16 },
    { id: 'package', version: '1', entries: 14, capacity: 32 },
    { id: 'decision_level', version: '1', entries: 4, capacity: 8 },
  ];

  var prefixes = [
    p('page_view', 'Page View', 'observation', ['env', 'region', 'service', 'namespace']),
    p('endpoint', 'Endpoint', 'entity', ['env', 'region', 'service', 'namespace', 'resource']),
    p('flow_point', 'Flow Point', 'event', ['service', 'flow_phase', 'actor']),
    p('order_event', 'Order Event', 'event', ['service', 'event_kind', 'actor']),
    p('permission', 'Permission', 'policy', ['service', 'actor', 'resource']),
    p('event', 'Event', 'event', ['service', 'event_kind']),
    p('deploy_event', 'Deploy Event', 'event', ['env', 'region', 'service', 'lifecycle_state']),
    p('health_event', 'Health Event', 'observation', [
      'env',
      'region',
      'service',
      'quality_signal',
    ]),
    p('pattern_match', 'Pattern Match', 'observation', ['service', 'flow_phase', 'quality_signal']),
    p('pattern_anomaly', 'Pattern Anomaly', 'observation', [
      'service',
      'flow_phase',
      'quality_signal',
    ]),
    p('cart_event', 'Cart Event', 'event', ['service', 'event_kind', 'actor']),
    p('tracking', 'Tracking', 'observation', ['service', 'actor', 'resource']),
    p('dkg_event', 'DKG Event', 'event', ['decision_level', 'service', 'quality_signal']),
    p('dkg_decision_event', 'DKG Decision', 'event', ['decision_level', 'actor', 'resource']),
    p('dkg_observation_event', 'DKG Observation', 'observation', [
      'decision_level',
      'quality_signal',
    ]),
    p('build_event', 'Build Event', 'event', ['package', 'quality_signal']),
    p('test_event', 'Test Event', 'event', ['package', 'quality_signal']),
    p('contract_check', 'Contract Check', 'policy', ['package', 'quality_signal']),
    p('auth_event', 'Auth Event', 'event', ['service', 'actor']),
    p('rbac', 'RBAC', 'policy', ['service', 'actor', 'resource']),
    p('content', 'Content', 'entity', ['service', 'namespace', 'resource']),
    p('schema_event', 'Schema Event', 'event', ['package', 'lifecycle_state']),
    p('engine_event', 'Engine Event', 'event', ['package', 'flow_phase', 'quality_signal']),
    p('schema_validation', 'Schema Validation', 'policy', ['package', 'quality_signal']),
    p('pipeline_point', 'Pipeline Point', 'event', ['package', 'flow_phase']),
    p('validation_event', 'Validation Event', 'event', ['package', 'quality_signal']),
    p('version_state', 'Version State', 'entity', ['package', 'lifecycle_state']),
    p('metric_aggregate', 'Metric Aggregate', 'observation', ['service', 'quality_signal']),
  ];

  var consumers = [
    {
      id: 'platform-demo',
      role: 'visualizer',
      prefixes: ['page_view', 'endpoint', 'flow_point', 'permission'],
    },
    {
      id: 'ingest-server',
      role: 'collector',
      prefixes: ['event', 'tracking', 'health_event', 'metric_aggregate'],
    },
    {
      id: 'registry-service',
      role: 'registry',
      prefixes: ['version_state', 'schema_event', 'dkg_event'],
    },
    {
      id: 'definition-catalog',
      role: 'knowledge',
      prefixes: ['contract_check', 'schema_validation'],
    },
  ];

  var observedPrefixes = [
    { prefix: 'page_view', count: 24 },
    { prefix: 'endpoint', count: 31 },
    { prefix: 'flow_point', count: 18 },
    { prefix: 'order_event', count: 9 },
    { prefix: 'permission', count: 11 },
    { prefix: 'event', count: 42 },
    { prefix: 'deploy_event', count: 4 },
    { prefix: 'health_event', count: 7 },
    { prefix: 'pattern_match', count: 8 },
    { prefix: 'pattern_anomaly', count: 2 },
    { prefix: 'tracking', count: 19 },
    { prefix: 'build_event', count: 6 },
    { prefix: 'test_event', count: 6 },
    { prefix: 'contract_check', count: 5 },
    { prefix: 'metric_aggregate', count: 5 },
  ];

  var flowMap = {
    layers: {
      schema: axes,
      prefix: prefixes,
      consumer: consumers,
    },
    progress: {
      defined: prefixes.length,
      active: 25,
      draft: 3,
      deprecated: 0,
    },
    edges: prefixes
      .reduce(function (acc, item) {
        item.axes.forEach(function (axisId) {
          acc.push({ from: axisId, to: item.id, type: 'composes' });
        });
        return acc;
      }, [])
      .concat(
        consumers.reduce(function (acc, item) {
          item.prefixes.forEach(function (prefixId) {
            acc.push({ from: prefixId, to: item.id, type: 'consumes' });
          });
          return acc;
        }, []),
      ),
  };

  var intentLinks = [
    il('IL-checkout-flow', ['page_view', 'endpoint', 'flow_point', 'order_event', 'permission']),
    il('IL-api-event', ['endpoint', 'event']),
    il('IL-infra-impact', ['deploy_event', 'health_event', 'endpoint']),
    il('IL-pattern-observation', ['pattern_match', 'pattern_anomaly', 'flow_point']),
    il('IL-cart-abandon', ['cart_event', 'order_event', 'tracking']),
    il('IL-dkg-operation', ['dkg_event', 'dkg_decision_event', 'dkg_observation_event']),
    il('IL-build-test', ['build_event', 'test_event', 'contract_check']),
    il('IL-auth-permission', ['auth_event', 'permission', 'rbac']),
    il('IL-schema-engine', ['schema_event', 'engine_event', 'schema_validation']),
    il('IL-pipeline-flow', ['pipeline_point', 'engine_event', 'schema_event', 'validation_event']),
    il('IL-version-rollout', ['version_state', 'metric_aggregate', 'deploy_event', 'health_event']),
  ];

  var now = Date.now();
  var traces = [
    trace('demo-trace-checkout', 'platform-demo', 5, now - 90 * 1000),
    trace('demo-trace-deploy', 'gateway', 4, now - 4 * 60 * 1000),
    trace('demo-trace-schema', 'registry-service', 4, now - 9 * 60 * 1000),
    trace('demo-trace-build', 'definition-catalog', 3, now - 16 * 60 * 1000),
  ];

  var traceRecordsById = {
    'demo-trace-checkout': records('demo-trace-checkout', [
      rec('ui.page.view', 'page_view', 'page_view:v1:42'),
      rec('api.endpoint.call', 'endpoint', 'endpoint:v1:88'),
      rec('flow.point', 'flow_point', 'flow_point:v1:13'),
      rec('order.created', 'order_event', 'order_event:v1:7'),
      rec('permission.checked', 'permission', 'permission:v1:19'),
    ]),
    'demo-trace-deploy': records('demo-trace-deploy', [
      rec('deploy.started', 'deploy_event', 'deploy_event:v1:3'),
      rec('health.degraded', 'health_event', 'health_event:v1:6'),
      rec('api.endpoint.call', 'endpoint', 'endpoint:v1:88'),
      rec('metric.aggregate', 'metric_aggregate', 'metric_aggregate:v1:5'),
    ]),
    'demo-trace-schema': records('demo-trace-schema', [
      rec('schema.changed', 'schema_event', 'schema_event:v1:11'),
      rec('engine.evaluated', 'engine_event', 'engine_event:v1:9'),
      rec('schema.validated', 'schema_validation', 'schema_validation:v1:4'),
      rec('validation.completed', 'validation_event', 'validation_event:v1:12'),
    ]),
    'demo-trace-build': records('demo-trace-build', [
      rec('build.completed', 'build_event', 'build_event:v1:8'),
      rec('test.completed', 'test_event', 'test_event:v1:8'),
      rec('contract.checked', 'contract_check', 'contract_check:v1:5'),
    ]),
  };

  window.__QA_DEMO_FALLBACK__ = {
    dashboard: {
      overview: {
        nodes: { axis: axes.length, prefix: prefixes.length, domain: 6, decision: 5 },
        observations: { unresolved: 2, resolved: 7 },
        health: { constraints: 'read-model online' },
      },
      flowMap: flowMap,
      metrics: {
        summary: { total: 24, ok: 20, warning: 4, critical: 0 },
        byCategory: {
          headroom: { ok: 7, warning: 1, critical: 0 },
          skew: { ok: 3, warning: 1, critical: 0 },
          overlap: { ok: 4, warning: 0, critical: 0 },
          conflict: { ok: 3, warning: 0, critical: 0 },
          health: { ok: 3, warning: 2, critical: 0 },
          coverage: { ok: 2, warning: 1, critical: 0 },
        },
        observations: { unresolved: 2 },
      },
      timeline: {
        total: 5,
        events: [
          timeline('decision', 'D-101', 'Route demo pages through same-origin API proxy.', [
            'platform-demo',
            'gateway',
          ]),
          timeline(
            'observation',
            'OBS-244',
            'Dashboard and diagrams fell back to demo read-model.',
            ['dashboard', 'diagram'],
            true,
          ),
          timeline('version-event', 'VER-37', 'Service prefix demo data refreshed.', [
            'service',
            'v1',
            'v2',
          ]),
          timeline('observation', 'OBS-239', 'Range page UI bounded to current service shape.', [
            'range',
            'service',
          ]),
          timeline('decision', 'D-098', 'Separate display data from canonical demo catalog.', [
            'demo-display-data',
          ]),
        ],
      },
      observedPrefixes: toObservedMap(observedPrefixes),
    },
    flow: {
      flowMap: flowMap,
      observedPrefixes: observedPrefixes,
      intentLinks: intentLinks,
      recentTraces: traces,
      traceRecordsById: traceRecordsById,
    },
  };

  function p(id, name, category, itemAxes) {
    return {
      id: id,
      name: name,
      category: category,
      lifecycle: 'active',
      dimCount: itemAxes.length,
      axes: itemAxes.slice(),
    };
  }

  function il(id, endpoints) {
    return { id: id, label: id, endpoints: endpoints.slice() };
  }

  function trace(traceId, serviceName, recordCount, timestampMs) {
    var iso = new Date(timestampMs).toISOString();
    return {
      traceId: traceId,
      serviceName: serviceName,
      recordCount: recordCount,
      firstTimestamp: iso,
      lastTimestamp: iso,
    };
  }

  function records(traceId, items) {
    var base = Date.now() - 20 * 60 * 1000;
    return items.map(function (item, index) {
      return {
        logId: traceId + '-' + (index + 1),
        traceId: traceId,
        spanId: 'span-' + (index + 1),
        timestamp: new Date(base + index * 900).toISOString(),
        recordKind: 'event',
        eventKey: item.eventKey,
        addressContext: item.addressContext,
        payload: { source: 'platform-demo-fallback' },
      };
    });
  }

  function rec(eventKey, prefix, address) {
    var addressContext = {};
    addressContext[prefix] = address;
    return { eventKey: eventKey, addressContext: addressContext };
  }

  function timeline(kind, id, title, targets, resolved) {
    return {
      kind: kind,
      id: id,
      date: new Date(Date.now()).toISOString().slice(0, 10),
      title: title,
      targets: targets,
      resolved: !!resolved,
      loopClosed: !!resolved,
    };
  }

  function toObservedMap(items) {
    return items.reduce(function (acc, item) {
      acc[item.prefix] = item.count;
      return acc;
    }, {});
  }
})();
