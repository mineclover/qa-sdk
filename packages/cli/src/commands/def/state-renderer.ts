// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { VerificationReadModel } from '../../lib/spec-definition-verification.js';

export interface HarnessDocState {
  readonly id: string;
  readonly lifecycle: string;
  readonly specImpl: string;
  readonly convention: string;
  readonly verification?: VerificationReadModel;
}

export function printDistributionLine(label: string, states: readonly string[]): void {
  const counts = new Map<string, number>();
  for (const state of states) counts.set(state, (counts.get(state) ?? 0) + 1);
  const parts = [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .map(([state, count]) => `${state}(${count})`);
  console.log(`${label.padEnd(21)}${parts.join(' ')}`);
}

export function printVerificationReadModel(model: VerificationReadModel): void {
  console.log(`  verification-report:    ${model.reportStatus}`);
  console.log(`  verification-binding:   ${model.bindingStatus ?? 'none'}`);
  if (model.definitionAddress) console.log(`  definition-address:     ${model.definitionAddress}`);
  if (model.currentDocId) console.log(`  current-doc-id:         ${model.currentDocId}`);
  if (model.driftReport) {
    console.log(`  drift-coverage:         ${model.driftReport.coverage}`);
    console.log(`  drift-missing:          ${model.driftReport.missing.length}`);
    console.log(`  drift-undocumented:     ${model.driftReport.undocumented.length}`);
  }
  for (const diagnostic of model.diagnostics) {
    console.log(`  verification-diagnostic: ${diagnostic.code} — ${diagnostic.message}`);
  }
}

export function printMachineDistribution(
  machineId: string,
  docStates: readonly HarnessDocState[],
  syncState: string,
): void {
  const docMachineField: Record<string, keyof HarnessDocState> = {
    'doc-lifecycle': 'lifecycle',
    'spec-impl': 'specImpl',
    'convention-compliance': 'convention',
  };

  const field = docMachineField[machineId];
  if (field) {
    const values = docStates.map((document) => String(document[field]));
    printDistributionLine(machineId, values);
    console.log('\n상세:');
    for (const document of docStates) {
      console.log(`  ${document.id.padEnd(40)} ${document[field]}`);
    }
    return;
  }

  if (machineId === 'db-sync') {
    console.log(`db-sync: ${syncState}`);
    return;
  }

  console.log(`${machineId}: 외부 서비스 연결 필요`);
}
