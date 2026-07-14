import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const spec = JSON.parse(
  readFileSync(join(root, 'packages/contracts/openapi/.merged.openapi.json'), 'utf8'),
);

const requiredPaths = ['/assignments', '/bff/assignments/{id}'];
for (const path of requiredPaths) {
  if (!spec.paths?.[path]) {
    console.error(`missing OpenAPI path: ${path}`);
    process.exit(1);
  }
}

const schemas = spec.components?.schemas ?? {};
for (const schemaName of ['CreateAssignmentCommand', 'AssignmentDetailBffResponse']) {
  if (!schemas[schemaName]) {
    console.error(`missing OpenAPI schema: ${schemaName}`);
    process.exit(1);
  }
}

if (JSON.stringify(schemas).includes('AssignmentEntity')) {
  console.error('OpenAPI must not expose AssignmentEntity');
  process.exit(1);
}

if (!schemas.ErrorResponse) {
  console.error('merged OpenAPI must include common ErrorResponse schema');
  process.exit(1);
}

if (!spec.servers?.some((server) => server.url === 'http://localhost:3000')) {
  console.error('merged OpenAPI must include local profile server');
  process.exit(1);
}

console.log('merged assignment OpenAPI contract verified');
