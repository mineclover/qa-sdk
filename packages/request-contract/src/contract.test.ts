import { describe, expect, it } from 'vitest';
import {
  createRequestContract,
  evaluateObservation,
  normalizePromptTemplate,
  validateRequestContract,
} from './index.js';

describe('Prompt Template to Request Contract', () => {
  it('normalizes filled template slots into an executable and evaluable contract', () => {
    const template = normalizePromptTemplate({
      id: 'feature-request',
      role: 'senior engineer',
      context: {
        purpose: '요구사항을 실행 가능한 계약으로 정규화한다.',
        background: '사용자는 자연어로 요청을 입력한다.',
        audience: 'LLM Planner',
        currentState: '템플릿 슬롯이 채워진 상태',
      },
      references: {
        rag: [{ id: 'spec.md', label: '시스템 명세' }],
        skills: [{ id: 'tdd', label: 'TDD' }],
        policies: [{ id: 'no-network', label: '외부 네트워크 금지' }],
        examples: [{ id: 'example-1', label: '계약 예시' }],
      },
      request: 'Request Contract 패키지를 만든다.',
      output: {
        format: 'typescript-library',
        length: 'focused',
        language: 'ko',
        structure: ['types', 'normalizer', 'evaluator'],
      },
      constraints: {
        tone: 'concise',
        mustInclude: ['RequestContract', 'ObservationContract'],
        mustExclude: ['runtime fetch'],
        forbiddenActions: ['process.env 직접 접근'],
      },
      successCriteria: ['템플릿 입력이 계약으로 변환된다.', '관찰 결과를 계약 기준으로 평가한다.'],
    });

    const contract = createRequestContract(template);

    expect(contract.goal).toBe('Request Contract 패키지를 만든다.');
    expect(contract.task.instruction).toBe('Request Contract 패키지를 만든다.');
    expect(contract.outputSpec.structure).toEqual(['types', 'normalizer', 'evaluator']);
    expect(contract.reusableReferences.skills).toEqual([{ id: 'tdd', label: 'TDD' }]);
    expect(validateRequestContract(contract).valid).toBe(true);
  });

  it('reports validation diagnostics when required contract fields are missing', () => {
    const contract = createRequestContract(
      normalizePromptTemplate({
        id: 'incomplete',
        role: '',
        request: '',
        successCriteria: [],
      }),
    );

    const validation = validateRequestContract(contract);

    expect(validation.valid).toBe(false);
    expect(validation.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'role.required',
      'goal.required',
      'task.instruction.required',
      'successCriteria.required',
    ]);
  });
});

describe('Observation Contract evaluation', () => {
  const contract = createRequestContract(
    normalizePromptTemplate({
      id: 'contract-package',
      role: 'library author',
      request: 'Request Contract 패키지를 만든다.',
      output: {
        format: 'typescript-library',
        language: 'ko',
      },
      constraints: {
        mustInclude: ['RequestContract', 'ObservationContract'],
        mustExclude: ['runtime fetch'],
        forbiddenActions: ['process.env 직접 접근'],
      },
      successCriteria: ['테스트가 통과한다.', '빌드가 통과한다.'],
    }),
  );

  it('returns success when completion, success criteria, artifacts, and constraints align', () => {
    const result = evaluateObservation(contract, {
      id: 'obs-success',
      completed: true,
      artifacts: [
        { id: 'types', kind: 'source', summary: 'RequestContract and ObservationContract types' },
      ],
      logs: ['테스트가 통과한다.', '빌드가 통과한다.'],
      usedActions: ['vitest', 'tsup'],
      constraintSignals: [
        { rule: 'runtime fetch', violated: false },
        { rule: 'process.env 직접 접근', violated: false },
      ],
    });

    expect(result.status).toBe('success');
    expect(result.replanRequired).toBe(false);
  });

  it('returns partial when the run completes but success criteria are unmet', () => {
    const result = evaluateObservation(contract, {
      id: 'obs-partial',
      completed: true,
      artifacts: [{ id: 'types', kind: 'source', summary: 'RequestContract only' }],
      logs: ['테스트가 통과한다.'],
      usedActions: ['vitest'],
    });

    expect(result.status).toBe('partial');
    expect(result.replanRequired).toBe(true);
    expect(result.findings.map((finding) => finding.code)).toContain('successCriteria.unmet');
  });

  it('returns blocked when the observation reports a blocking error', () => {
    const result = evaluateObservation(contract, {
      id: 'obs-blocked',
      completed: false,
      errors: [
        {
          code: 'permission.denied',
          message: '파일을 쓸 권한이 없습니다.',
          blocking: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.replanRequired).toBe(false);
  });
});
