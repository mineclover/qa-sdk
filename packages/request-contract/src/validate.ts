import type {
  ContractDiagnostic,
  ContractMetadata,
  RequestContract,
  RequestContractValidation,
} from './types.js';

const EMPTY_METADATA: ContractMetadata = Object.freeze({});

function diagnostic(code: string, message: string, path: string): ContractDiagnostic {
  return {
    code,
    severity: 'error',
    message,
    path,
    metadata: EMPTY_METADATA,
  };
}

export function validateRequestContract(contract: RequestContract): RequestContractValidation {
  const diagnostics: ContractDiagnostic[] = [];

  if (contract.role.trim().length === 0) {
    diagnostics.push(diagnostic('role.required', 'role은 필수입니다.', 'role'));
  }

  if (contract.goal.trim().length === 0) {
    diagnostics.push(diagnostic('goal.required', 'goal은 필수입니다.', 'goal'));
  }

  if (contract.task.instruction.trim().length === 0) {
    diagnostics.push(
      diagnostic('task.instruction.required', 'task.instruction은 필수입니다.', 'task.instruction'),
    );
  }

  if (contract.successCriteria.length === 0) {
    diagnostics.push(
      diagnostic(
        'successCriteria.required',
        'successCriteria는 하나 이상 필요합니다.',
        'successCriteria',
      ),
    );
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}
