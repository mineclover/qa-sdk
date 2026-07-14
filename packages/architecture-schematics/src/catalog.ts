export interface TemplateRule {
  readonly id: string;
  readonly description: string;
  readonly rationale: string;
}

export interface TemplateArtifact {
  readonly id: string;
  readonly path: string;
  readonly layer:
    | 'domain'
    | 'application'
    | 'infrastructure'
    | 'presentation'
    | 'metadata'
    | 'module';
  readonly responsibility: string;
  readonly topology: 'entry' | 'component' | 'interface' | 'system' | 'layout';
}

export interface TemplateCatalog {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly artifacts: readonly TemplateArtifact[];
  readonly rules: readonly TemplateRule[];
}

export const DOMAIN_TEMPLATE_CATALOG: TemplateCatalog = {
  id: 'domain',
  version: '0.1.0',
  description: 'Domain Slice Architecture scaffold for NestJS services.',
  artifacts: [
    {
      id: 'domain-identity',
      path: 'domain/<name>.ids.ts',
      layer: 'domain',
      responsibility: 'Stable aggregate identity vocabulary.',
      topology: 'entry',
    },
    {
      id: 'domain-types',
      path: 'domain/<name>.types.ts',
      layer: 'domain',
      responsibility: 'Pure aggregate state and snapshot shape.',
      topology: 'component',
    },
    {
      id: 'domain-exception',
      path: 'domain/<name>.exceptions.ts',
      layer: 'domain',
      responsibility: 'Domain-specific error vocabulary.',
      topology: 'component',
    },
    {
      id: 'domain-entity',
      path: 'domain/<name>.entity.ts',
      layer: 'domain',
      responsibility: 'Pure domain invariant and state transition behavior.',
      topology: 'system',
    },
    {
      id: 'domain-entity-test',
      path: 'domain/<name>.entity.spec.ts',
      layer: 'domain',
      responsibility: 'Pure domain behavior test evidence.',
      topology: 'system',
    },
    {
      id: 'domain-index',
      path: 'domain/index.ts',
      layer: 'domain',
      responsibility: 'Domain public export surface.',
      topology: 'layout',
    },
    {
      id: 'application-use-case',
      path: 'application/use-cases/<name>.use-case.ts',
      layer: 'application',
      responsibility: 'Command orchestration through ports only.',
      topology: 'system',
    },
    {
      id: 'application-command',
      path: 'application/commands/create-<name>.command.ts',
      layer: 'application',
      responsibility: 'Purpose-specific command DTO.',
      topology: 'interface',
    },
    {
      id: 'repository-port',
      path: 'application/ports/<name>-repository.port.ts',
      layer: 'application',
      responsibility: 'Outbound repository contract.',
      topology: 'interface',
    },
    {
      id: 'outbox-port',
      path: 'application/ports/<name>-outbox.port.ts',
      layer: 'application',
      responsibility: 'Outbound domain event publication contract.',
      topology: 'interface',
    },
    {
      id: 'transaction-port',
      path: 'application/ports/<name>-transaction.port.ts',
      layer: 'application',
      responsibility: 'Use case transaction boundary contract.',
      topology: 'interface',
    },
    {
      id: 'logger-port',
      path: 'application/ports/<name>-logger.port.ts',
      layer: 'application',
      responsibility: 'Observable logging vocabulary contract.',
      topology: 'interface',
    },
    {
      id: 'read-model-port',
      path: 'application/queries/<name>.read-model.ts',
      layer: 'application',
      responsibility: 'Optional query-side read model contract.',
      topology: 'interface',
    },
    {
      id: 'drizzle-repository',
      path: 'infrastructure/persistence/<name>.repository.ts',
      layer: 'infrastructure',
      responsibility: 'Drizzle-backed adapter implementing the application port.',
      topology: 'system',
    },
    {
      id: 'drizzle-schema',
      path: 'infrastructure/persistence/<name>.schema.ts',
      layer: 'infrastructure',
      responsibility: 'Drizzle table skeleton.',
      topology: 'component',
    },
    {
      id: 'outbox-adapter',
      path: 'infrastructure/outbox/<name>.outbox.ts',
      layer: 'infrastructure',
      responsibility: 'Event publisher adapter implementing the outbox port.',
      topology: 'system',
    },
    {
      id: 'transaction-adapter',
      path: 'infrastructure/transaction/<name>.transaction.ts',
      layer: 'infrastructure',
      responsibility: 'Transaction port implementation.',
      topology: 'system',
    },
    {
      id: 'unit-of-work-store',
      path: 'infrastructure/transaction/<name>.unit-of-work.ts',
      layer: 'infrastructure',
      responsibility: 'Stages aggregate snapshots and outbox records before commit.',
      topology: 'system',
    },
    {
      id: 'logger-adapter',
      path: 'infrastructure/logging/<name>.logger.ts',
      layer: 'infrastructure',
      responsibility: 'Logger port implementation.',
      topology: 'system',
    },
    {
      id: 'read-model-adapter',
      path: 'infrastructure/read-model/<name>.read-model.ts',
      layer: 'infrastructure',
      responsibility: 'Read-model port implementation.',
      topology: 'system',
    },
    {
      id: 'controller',
      path: 'presentation/http/<name>.controller.ts',
      layer: 'presentation',
      responsibility: 'HTTP input adapter calling the use case.',
      topology: 'interface',
    },
    {
      id: 'bff',
      path: 'presentation/bff/<name>-detail.bff.ts',
      layer: 'presentation',
      responsibility: 'UI-facing BFF composition surface.',
      topology: 'system',
    },
    {
      id: 'bff-controller',
      path: 'presentation/bff/<name>-detail.controller.ts',
      layer: 'presentation',
      responsibility: 'BFF input adapter.',
      topology: 'interface',
    },
    {
      id: 'openapi-fragment',
      path: 'contracts/openapi/domains/<name>/spec.json',
      layer: 'presentation',
      responsibility: 'Consumer API contract fragment.',
      topology: 'interface',
    },
    {
      id: 'governance-metadata',
      path: 'metadata/openmetadata.seed.json',
      layer: 'metadata',
      responsibility: 'OpenMetadata and cache-key governance seed manifest.',
      topology: 'layout',
    },
    {
      id: 'nest-module',
      path: '<name>.module.ts',
      layer: 'module',
      responsibility: 'Nest provider wiring from port to adapter.',
      topology: 'layout',
    },
  ],
  rules: [
    {
      id: 'domain-is-pure',
      description: 'Domain files must not import NestJS, Drizzle, or infrastructure code.',
      rationale: 'Domain behavior must remain portable and testable without framework adapters.',
    },
    {
      id: 'application-uses-ports',
      description: 'Application files must not import infrastructure or Drizzle directly.',
      rationale: 'Use cases express intent and depend on outbound contracts, not adapter details.',
    },
    {
      id: 'presentation-calls-application',
      description: 'Presentation files must not import infrastructure repositories directly.',
      rationale: 'Controllers are input adapters and should call use cases.',
    },
    {
      id: 'module-binds-port',
      description: 'The generated Nest module binds repository ports to infrastructure adapters.',
      rationale: 'Dependency inversion is made explicit at the composition boundary.',
    },
    {
      id: 'metadata-ships-with-domain-slice',
      description: 'Generated domain slices include an OpenMetadata/cache-key seed manifest.',
      rationale: 'Read models and data assets need governance metadata from the first scaffold.',
    },
    {
      id: 'transaction-and-logging-are-ports',
      description: 'Use cases depend on transaction and logger ports, not infrastructure helpers.',
      rationale: 'Consistency and observability boundaries must be testable application contracts.',
    },
    {
      id: 'bff-does-not-expose-domain-entity',
      description: 'BFF files compose read models and must not expose domain entities.',
      rationale: 'UI-facing shape changes independently from the write model.',
    },
  ],
};

export function listTemplateCatalogs(): readonly TemplateCatalog[] {
  return [DOMAIN_TEMPLATE_CATALOG];
}
