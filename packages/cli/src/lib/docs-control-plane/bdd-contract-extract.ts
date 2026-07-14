// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import {
  bddContractBlockSchema,
  type BddContract,
  type BddImplementationUnit,
  type BddTestUnit,
} from '@qa-sdk/core';

export type BddContractDiagnosticSeverity = 'error' | 'warning';

export interface BddContractDiagnostic {
  readonly code: string;
  readonly severity: BddContractDiagnosticSeverity;
  readonly message: string;
  readonly sourcePath: string;
  readonly pointer: string;
  readonly contractId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface BddDocumentMetadata {
  readonly contracts: readonly BddContract[];
  readonly testUnits: readonly BddTestUnit[];
  readonly implementationUnits: readonly BddImplementationUnit[];
  readonly diagnostics: readonly BddContractDiagnostic[];
}

export interface BddValidationDocument {
  readonly sourcePath: string;
  readonly bdd: BddDocumentMetadata;
}

const BDD_BLOCK_RE = /```(?:yaml|yml)\s+bdd[^\n]*\n([\s\S]*?)```/g;

export function extractBddDocumentMetadata(
  sourcePath: string,
  markdown: string,
): BddDocumentMetadata {
  const contracts: BddContract[] = [];
  const testUnits: BddTestUnit[] = [];
  const implementationUnits: BddImplementationUnit[] = [];
  const diagnostics: BddContractDiagnostic[] = [];

  let blockIndex = 0;
  for (const match of markdown.matchAll(BDD_BLOCK_RE)) {
    blockIndex += 1;
    const pointer = `bdd-block:${blockIndex}`;
    const rawYaml = match[1] ?? '';

    let parsedYaml: unknown;
    try {
      parsedYaml = parseBddYaml(rawYaml);
    } catch (error) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer,
          code: 'bdd-yaml-parse-error',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      continue;
    }

    const parsedBlock = bddContractBlockSchema.safeParse(parsedYaml);
    if (!parsedBlock.success) {
      for (const issue of parsedBlock.error.issues) {
        diagnostics.push(
          diagnostic({
            sourcePath,
            pointer,
            code: 'bdd-schema-error',
            severity: 'error',
            message: `${issue.path.join('.') || 'bdd'}: ${issue.message}`,
          }),
        );
      }
      continue;
    }

    contracts.push(...parsedBlock.data.contracts);
    testUnits.push(...parsedBlock.data.testUnits);
    implementationUnits.push(...parsedBlock.data.implementationUnits);
  }

  diagnostics.push(
    ...validateSingleBddDocument({
      sourcePath,
      contracts,
    }),
  );

  return {
    contracts,
    testUnits,
    implementationUnits,
    diagnostics,
  };
}

function parseBddYaml(yaml: string): Record<string, unknown> {
  const lines = yaml
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'))
    .map((line) => ({
      indent: line.length - line.trimStart().length,
      text: line.trim(),
    }));
  let index = 0;

  function parseObject(indent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indent) break;
      if (line.indent > indent) break;
      if (line.text.startsWith('- ')) break;

      const parsed = parseKeyValue(line.text);
      if (!parsed) {
        index += 1;
        continue;
      }
      index += 1;
      if (parsed.value === '') {
        result[parsed.key] = parseNested(line.indent);
      } else {
        result[parsed.key] = parseScalarOrInlineArray(parsed.value);
      }
    }
    return result;
  }

  function parseNested(parentIndent: number): unknown {
    const next = lines[index];
    if (!next || next.indent <= parentIndent) return {};
    if (next.text.startsWith('- ')) return parseArray(next.indent);
    return parseObject(next.indent);
  }

  function parseArray(indent: number): unknown[] {
    const result: unknown[] = [];
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indent) break;
      if (line.indent !== indent || !line.text.startsWith('- ')) break;

      const rest = line.text.slice(2).trim();
      index += 1;
      const parsed = parseKeyValue(rest);
      if (!parsed) {
        result.push(parseScalarOrInlineArray(rest));
        continue;
      }

      const item: Record<string, unknown> = {};
      item[parsed.key] =
        parsed.value === '' ? parseNested(line.indent) : parseScalarOrInlineArray(parsed.value);

      while (index < lines.length) {
        const next = lines[index]!;
        if (next.indent <= line.indent) break;
        if (next.indent !== line.indent + 2 || next.text.startsWith('- ')) break;

        const continuation = parseKeyValue(next.text);
        if (!continuation) {
          index += 1;
          continue;
        }
        index += 1;
        item[continuation.key] =
          continuation.value === ''
            ? parseNested(next.indent)
            : parseScalarOrInlineArray(continuation.value);
      }
      result.push(item);
    }
    return result;
  }

  return parseObject(0);
}

function parseKeyValue(text: string): { key: string; value: string } | null {
  const match = text.match(/^([^:]+):\s*(.*)$/);
  if (!match?.[1]) return null;
  return {
    key: match[1].trim(),
    value: match[2]?.trim() ?? '',
  };
}

function parseScalarOrInlineArray(value: string): unknown {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item.trim()));
  }
  return parseScalar(value);
}

function parseScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const numberValue = Number(value);
  if (!Number.isNaN(numberValue) && value.trim() !== '') return numberValue;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function hasBddMetadata(metadata: BddDocumentMetadata): boolean {
  return (
    metadata.contracts.length > 0 ||
    metadata.testUnits.length > 0 ||
    metadata.implementationUnits.length > 0 ||
    metadata.diagnostics.length > 0
  );
}

export function validateBddDocumentSet(
  documents: readonly BddValidationDocument[],
): readonly BddContractDiagnostic[] {
  const diagnostics: BddContractDiagnostic[] = [];
  const contractById = new Map<
    string,
    {
      readonly contract: BddContract;
      readonly sourcePath: string;
    }
  >();
  const duplicateIds = new Set<string>();
  const testUnitsByContract = new Map<string, BddTestUnit[]>();
  const implementationUnitsByContract = new Map<string, BddImplementationUnit[]>();

  for (const document of documents) {
    for (const contract of document.bdd.contracts) {
      if (contractById.has(contract.id)) {
        duplicateIds.add(contract.id);
        continue;
      }
      contractById.set(contract.id, {
        contract,
        sourcePath: document.sourcePath,
      });
    }
    for (const unit of document.bdd.testUnits) {
      const items = testUnitsByContract.get(unit.contract) ?? [];
      items.push(unit);
      testUnitsByContract.set(unit.contract, items);
    }
    for (const unit of document.bdd.implementationUnits) {
      const items = implementationUnitsByContract.get(unit.contract) ?? [];
      items.push(unit);
      implementationUnitsByContract.set(unit.contract, items);
    }
  }

  for (const id of duplicateIds) {
    diagnostics.push(
      diagnostic({
        sourcePath: contractById.get(id)?.sourcePath ?? '',
        pointer: 'bdd.contracts',
        code: 'bdd-duplicate-contract-id',
        severity: 'error',
        message: `Duplicate BDD contract id in validation scope: ${id}`,
        contractId: id,
      }),
    );
  }

  for (const document of documents) {
    for (const unit of document.bdd.testUnits) {
      if (!contractById.has(unit.contract)) {
        diagnostics.push(
          diagnostic({
            sourcePath: document.sourcePath,
            pointer: `test_unit:${unit.id}`,
            code: 'bdd-test-unit-contract-missing',
            severity: 'error',
            message: `test_unit ${unit.id} references unknown BDD contract ${unit.contract}`,
            contractId: unit.contract,
          }),
        );
      }
    }

    for (const unit of document.bdd.implementationUnits) {
      const contractEntry = contractById.get(unit.contract);
      if (!contractEntry) {
        diagnostics.push(
          diagnostic({
            sourcePath: document.sourcePath,
            pointer: `implementation_unit:${unit.id}`,
            code: 'bdd-implementation-unit-contract-missing',
            severity: 'error',
            message: `implementation_unit ${unit.id} references unknown BDD contract ${unit.contract}`,
            contractId: unit.contract,
          }),
        );
        continue;
      }

      if (unit.ownedBy !== contractEntry.contract.ownerSystem) {
        diagnostics.push(
          diagnostic({
            sourcePath: document.sourcePath,
            pointer: `implementation_unit:${unit.id}`,
            code: 'bdd-cross-owner-implementation-unit',
            severity: 'warning',
            message: `implementation_unit ${unit.id} is owned by ${unit.ownedBy}, but contract ${contractEntry.contract.id} is owned by ${contractEntry.contract.ownerSystem}. Use a separate contract or escalation if this is intentional.`,
            contractId: contractEntry.contract.id,
            metadata: {
              implementationUnitId: unit.id,
              ownedBy: unit.ownedBy,
              ownerSystem: contractEntry.contract.ownerSystem,
            },
          }),
        );
      }
    }
  }

  const allContracts = [...contractById.values()].map((entry) => entry.contract);
  const hasFailureScenario = allContracts.some(
    (contract) => contract.contractKind === 'validation-failure' || Boolean(contract.then.error),
  );

  for (const { contract, sourcePath } of contractById.values()) {
    if ((testUnitsByContract.get(contract.id)?.length ?? 0) === 0) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: `bdd_contract:${contract.id}`,
          code: 'bdd-contract-missing-test-unit',
          severity: 'warning',
          message: `BDD contract ${contract.id} has no test_unit evidence.`,
          contractId: contract.id,
        }),
      );
    }

    if (
      contract.mode === 'write' &&
      (implementationUnitsByContract.get(contract.id)?.length ?? 0) === 0
    ) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: `bdd_contract:${contract.id}`,
          code: 'bdd-write-contract-missing-implementation-unit',
          severity: 'warning',
          message: `write-mode BDD contract ${contract.id} has no implementation_unit.`,
          contractId: contract.id,
        }),
      );
    }

    if (contract.mode === 'write' && !hasFailureScenario) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: `bdd_contract:${contract.id}`,
          code: 'bdd-write-contract-missing-failure-path',
          severity: 'warning',
          message: 'write-mode contract should include a validation-failure scenario.',
          contractId: contract.id,
        }),
      );
    }
  }

  diagnostics.push(...detectDeterminismConflictsFromDocuments(documents));
  return diagnostics;
}

function validateSingleBddDocument(input: {
  readonly sourcePath: string;
  readonly contracts: readonly BddContract[];
}): BddContractDiagnostic[] {
  const diagnostics: BddContractDiagnostic[] = [];
  const contractById = new Map<string, BddContract>();
  const duplicateIds = new Set<string>();

  for (const contract of input.contracts) {
    if (contractById.has(contract.id)) {
      duplicateIds.add(contract.id);
      continue;
    }
    contractById.set(contract.id, contract);
  }

  for (const id of duplicateIds) {
    diagnostics.push(
      diagnostic({
        sourcePath: input.sourcePath,
        pointer: 'bdd.contracts',
        code: 'bdd-duplicate-contract-id',
        severity: 'error',
        message: `Duplicate BDD contract id: ${id}`,
        contractId: id,
      }),
    );
  }

  diagnostics.push(...detectDeterminismConflicts(input.sourcePath, input.contracts));
  return diagnostics;
}

function detectDeterminismConflictsFromDocuments(
  documents: readonly BddValidationDocument[],
): BddContractDiagnostic[] {
  const diagnostics: BddContractDiagnostic[] = [];
  const byKey = new Map<
    string,
    {
      readonly contract: BddContract;
      readonly sourcePath: string;
    }
  >();

  for (const document of documents) {
    for (const contract of document.bdd.contracts) {
      const key = deterministicKey(contract);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { contract, sourcePath: document.sourcePath });
        continue;
      }

      if (outcomeSignature(existing.contract) !== outcomeSignature(contract)) {
        diagnostics.push(
          diagnostic({
            sourcePath: document.sourcePath,
            pointer: `bdd_contract:${contract.id}`,
            code: 'bdd-determinism-conflict',
            severity: 'error',
            message: `BDD contract ${contract.id} conflicts with ${existing.contract.id} for the same Given/When key.`,
            contractId: contract.id,
            metadata: {
              existingContractId: existing.contract.id,
              existingSourcePath: existing.sourcePath,
              key,
            },
          }),
        );
      }
    }
  }

  return diagnostics;
}

function detectDeterminismConflicts(
  sourcePath: string,
  contracts: readonly BddContract[],
): BddContractDiagnostic[] {
  const byKey = new Map<string, BddContract>();
  const diagnostics: BddContractDiagnostic[] = [];

  for (const contract of contracts) {
    const key = deterministicKey(contract);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, contract);
      continue;
    }

    if (outcomeSignature(existing) !== outcomeSignature(contract)) {
      diagnostics.push(
        diagnostic({
          sourcePath,
          pointer: `bdd_contract:${contract.id}`,
          code: 'bdd-determinism-conflict',
          severity: 'error',
          message: `BDD contract ${contract.id} conflicts with ${existing.id} for the same Given/When key.`,
          contractId: contract.id,
          metadata: {
            existingContractId: existing.id,
            key,
          },
        }),
      );
    }
  }

  return diagnostics;
}

function deterministicKey(contract: BddContract): string {
  const predicates = [...(contract.given.predicates ?? [])].toSorted();
  return JSON.stringify({
    ownerSystem: contract.ownerSystem,
    state: contract.given.state ?? '',
    operation: contract.when.operation ?? '',
    eventKey: contract.when.eventKey ?? '',
    predicates,
  });
}

function outcomeSignature(contract: BddContract): string {
  return JSON.stringify({
    state: contract.then.state ?? '',
    error: contract.then.error?.code ?? '',
  });
}

function diagnostic(input: {
  readonly sourcePath: string;
  readonly pointer: string;
  readonly code: string;
  readonly severity: BddContractDiagnosticSeverity;
  readonly message: string;
  readonly contractId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): BddContractDiagnostic {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    sourcePath: input.sourcePath,
    pointer: input.pointer,
    ...(input.contractId ? { contractId: input.contractId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}
