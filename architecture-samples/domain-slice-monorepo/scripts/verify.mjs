import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

const requiredFiles = [
  'pnpm-workspace.yaml',
  'apps/api/package.json',
  'apps/worker/package.json',
  'packages/contracts/package.json',
  'packages/platform/package.json',
  'apps/api/src/modules/assignment/domain/assignment.ids.ts',
  'apps/api/src/modules/assignment/domain/assignment.types.ts',
  'apps/api/src/modules/assignment/domain/assignment.entity.ts',
  'apps/api/src/modules/assignment/application/ports/assignment-repository.port.ts',
  'apps/api/src/modules/assignment/application/ports/assignment-outbox.port.ts',
  'apps/api/src/modules/assignment/application/ports/assignment-transaction.port.ts',
  'apps/api/src/modules/assignment/application/ports/assignment-logger.port.ts',
  'apps/api/src/modules/assignment/application/queries/assignment-read-model.query.ts',
  'apps/api/src/modules/assignment/application/use-cases/assignment.use-case.ts',
  'apps/api/src/modules/assignment/infrastructure/persistence/assignment.repository.ts',
  'apps/api/src/modules/assignment/infrastructure/outbox/assignment.outbox.ts',
  'apps/api/src/modules/assignment/infrastructure/transaction/assignment.drizzle-transaction.ts',
  'apps/api/src/modules/assignment/infrastructure/transaction/assignment.transaction.ts',
  'apps/api/src/modules/assignment/infrastructure/transaction/assignment.unit-of-work.ts',
  'apps/api/src/modules/assignment/infrastructure/logging/assignment.logger.ts',
  'apps/api/src/modules/assignment/infrastructure/read-model/assignment.read-model.ts',
  'apps/api/src/modules/assignment/presentation/http/assignment.controller.ts',
  'apps/api/src/modules/assignment/presentation/bff/assignment-detail.bff.ts',
  'apps/api/src/modules/assignment/presentation/bff/assignment-detail.controller.ts',
  'apps/api/src/modules/assignment/metadata/openmetadata.seed.json',
  'apps/api/src/modules/billing/application/ports/assignment-state.query-port.ts',
  'apps/api/src/modules/billing/application/ports/billing-logger.port.ts',
  'apps/api/src/modules/billing/application/ports/billing-transaction.port.ts',
  'apps/api/src/modules/billing/application/use-cases/create-billing.use-case.ts',
  'apps/api/src/modules/billing/domain/billing.entity.ts',
  'apps/worker/src/projectors/assignment-read-model.projector.ts',
  'packages/contracts/openapi/base.openapi.json',
  'packages/contracts/openapi/profiles/local.json',
  'packages/contracts/openapi/domains/common/spec.json',
  'packages/contracts/openapi/domains/assignment/spec.json',
  'infra/docker-compose.yml',
  'infra/k8s/api-deployment.yaml',
  'infra/k8s/worker-deployment.yaml',
  'docs/horizontal-scaling-guide.md',
  'docs/source-architecture/README.md',
  'docs/source-architecture/current/README.md',
  'docs/source-architecture/current/01-domain-slice-reference.md',
  'docs/source-architecture/current/02-command-query-contracts.md',
  'docs/source-architecture/current/03-transaction-events-cache.md',
  'docs/source-architecture/current/04-governance-logging-testing-bff.md',
  'docs/scenarios/assignment-create-and-bff.md',
  'docs/scenarios/cross-domain-precondition-billing.md',
  'scripts/merge-openapi.mjs',
  'scripts/check-openapi.mjs',
  'tests/assignment-use-case.test.ts',
  'tests/assignment-domain.test.ts',
  'tests/assignment-drizzle-transaction.test.ts',
  'tests/assignment-unit-of-work.test.ts',
  'tests/assignment-bff.test.ts',
  'tests/assignment-projector.test.ts',
  'tests/billing-cross-domain-precondition.test.ts',
  'tests/openapi-merge.test.mjs',
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));

if (missing.length > 0) {
  console.error('missing sample files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const useCase = readFileSync(
  join(root, 'apps/api/src/modules/assignment/application/use-cases/assignment.use-case.ts'),
  'utf8',
);
if (useCase.includes('infrastructure/')) {
  console.error('application use case must not import infrastructure');
  process.exit(1);
}

if (!useCase.includes('AssignmentTransactionPort') || !useCase.includes('AssignmentLoggerPort')) {
  console.error('application use case must use transaction and logger ports');
  process.exit(1);
}

const bff = readFileSync(
  join(root, 'apps/api/src/modules/assignment/presentation/bff/assignment-detail.bff.ts'),
  'utf8',
);
if (bff.includes('save(') || bff.includes('AssignmentEntity')) {
  console.error('BFF must not mutate domain state or expose domain entity');
  process.exit(1);
}

const bffController = readFileSync(
  join(root, 'apps/api/src/modules/assignment/presentation/bff/assignment-detail.controller.ts'),
  'utf8',
);
if (!bffController.includes('AssignmentDetailBff')) {
  console.error('BFF controller must delegate to AssignmentDetailBff');
  process.exit(1);
}

const workerProjector = readFileSync(
  join(root, 'apps/worker/src/projectors/assignment-read-model.projector.ts'),
  'utf8',
);
if (
  !workerProjector.includes('AssignmentCreatedPayload') ||
  !workerProjector.includes('applyCreated')
) {
  console.error('worker projector must consume assignment created contract');
  process.exit(1);
}

const unitOfWork = readFileSync(
  join(
    root,
    'apps/api/src/modules/assignment/infrastructure/transaction/assignment.unit-of-work.ts',
  ),
  'utf8',
);
if (!unitOfWork.includes('pendingAssignments') || !unitOfWork.includes('pendingOutbox')) {
  console.error('unit of work must stage assignment state and outbox records together');
  process.exit(1);
}

const metadata = JSON.parse(
  readFileSync(
    join(root, 'apps/api/src/modules/assignment/metadata/openmetadata.seed.json'),
    'utf8',
  ),
);
if (!Array.isArray(metadata.cacheKeys) || metadata.cacheKeys.length === 0) {
  console.error('metadata seed must include cacheKeys');
  process.exit(1);
}

if (!metadata.cacheKeys.some((key) => key.id === 'assignment-bff-detail')) {
  console.error('metadata seed must include BFF cache key metadata');
  process.exit(1);
}

const assignmentOpenApi = readFileSync(
  join(root, 'packages/contracts/openapi/domains/assignment/spec.json'),
  'utf8',
);
if (assignmentOpenApi.includes('AssignmentEntity')) {
  console.error('domain OpenAPI fragment must not expose AssignmentEntity');
  process.exit(1);
}

const mergeOpenApi = readFileSync(join(root, 'scripts/merge-openapi.mjs'), 'utf8');
if (
  !mergeOpenApi.includes('duplicate ${label}') ||
  !mergeOpenApi.includes('"OpenAPI path"') ||
  !mergeOpenApi.includes('left === "common"')
) {
  console.error(
    'OpenAPI merge script must enforce duplicate detection and common-first merge order',
  );
  process.exit(1);
}

const currentReference = readFileSync(
  join(root, 'docs/source-architecture/current/README.md'),
  'utf8',
);
if (
  !currentReference.includes('Domain Slice Architecture') ||
  !currentReference.includes('Responsibility Topology')
) {
  console.error(
    'current architecture reference must name Domain Slice Architecture and Responsibility Topology',
  );
  process.exit(1);
}

console.log('domain-slice-monorepo sample verified');
