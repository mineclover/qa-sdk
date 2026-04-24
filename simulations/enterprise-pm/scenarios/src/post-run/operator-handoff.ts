// @def.boundary sim-scenarios
// @def.doc authorization-ontology-nested-audit-tracing

function prefix(label: string | undefined): string {
  return label ? `${label}: ` : "";
}

export function auditTraceHint(rootSpanId: string, label?: string): string {
  return `${prefix(label)}pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id ${rootSpanId}`;
}

export function auditFirstFailureHint(
  rootSpanId: string,
  label?: string,
): string {
  return `${prefix(label)}pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id ${rootSpanId}`;
}

export function auditEntryHint(spanId: string, label?: string): string {
  return `${prefix(label)}pnpm --filter @qa-sdk/sim-scenarios start -- audit entry --span-id ${spanId}`;
}

export function auditContextHint(
  rootSpanId: string,
  graphId: string,
  label?: string,
): string {
  return `${prefix(label)}pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id ${rootSpanId} --graph-id ${graphId}`;
}
