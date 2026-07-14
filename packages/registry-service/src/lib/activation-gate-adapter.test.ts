// @def.boundary registry-system
// @def.doc registry-system

import { describe, it, expect, vi } from 'vitest';
import { createActivationGate, type ActivationGateConfig } from './activation-gate-adapter.js';

function createMockConfig(overrides?: Partial<ActivationGateConfig>): ActivationGateConfig {
  return {
    mode: 'warn',
    graphProvider: vi.fn().mockReturnValue({ mockGraph: true }),
    checkFn: vi.fn().mockReturnValue({
      allowed: true,
      diagnostics: [],
      constraintViolations: 0,
    }),
    ...overrides,
  };
}

describe('createActivationGate', () => {
  // ── 기본 동작 ──────────────────────────────────────────

  it('check() 호출 시 graphProvider → checkFn → 결과 반환', async () => {
    const config = createMockConfig();
    const gate = createActivationGate(config);

    const result = await gate.check('tracking', 'v1');

    expect(config.graphProvider).toHaveBeenCalled();
    expect(config.checkFn).toHaveBeenCalledWith({ mockGraph: true }, 'tracking', {
      mode: 'warn',
      schemaCheck: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  // ── warn 모드 ──────────────────────────────────────────

  it('warn 모드: constraint violation이 있어도 allowed=true + diagnostics 전달', async () => {
    const config = createMockConfig({
      mode: 'warn',
      checkFn: vi.fn().mockReturnValue({
        allowed: true,
        diagnostics: [{ level: 'error', source: 'constraint', id: 'C-001', message: 'violated' }],
        constraintViolations: 1,
      }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('tracking', 'v1');

    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].source).toBe('constraint');
  });

  // ── strict 모드 ─────────────────────────────────────────

  it('strict 모드: constraint violation 시 allowed=false', async () => {
    const config = createMockConfig({
      mode: 'strict',
      checkFn: vi.fn().mockReturnValue({
        allowed: false,
        diagnostics: [{ level: 'error', source: 'constraint', id: 'C-001', message: 'violated' }],
        constraintViolations: 1,
      }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('tracking', 'v1');

    expect(result.allowed).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
  });

  it('strict 모드: violation 없으면 allowed=true', async () => {
    const config = createMockConfig({
      mode: 'strict',
      checkFn: vi.fn().mockReturnValue({
        allowed: true,
        diagnostics: [
          { level: 'warning', source: 'observation', id: 'OBS-1', message: 'unresolved' },
        ],
        constraintViolations: 0,
      }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('tracking', 'v1');

    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
  });

  // ── Fail-open 패턴 ────────────────────────────────────

  it('graphProvider 에러 → fail-open (allowed=true + GATE_ERROR warning)', async () => {
    const config = createMockConfig({
      graphProvider: vi.fn().mockImplementation(() => {
        throw new Error('DB connection failed');
      }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('tracking', 'v1');

    expect(result.allowed).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].id).toBe('GATE_ERROR');
    expect(result.diagnostics[0].level).toBe('warning');
    expect(result.diagnostics[0].message).toContain('DB connection failed');
  });

  it('checkFn 에러 → fail-open', async () => {
    const config = createMockConfig({
      checkFn: vi.fn().mockImplementation(() => {
        throw new Error('unexpected');
      }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('tracking', 'v1');

    expect(result.allowed).toBe(true);
    expect(result.diagnostics[0].source).toBe('gate-error');
  });

  // ── 인터페이스 호환 ──────────────────────────────────────

  it('versionId는 checkFn에 전달되지 않음 (prefix 단위 검사)', async () => {
    const config = createMockConfig();
    const gate = createActivationGate(config);

    await gate.check('tracking', 'v2');

    // checkFn은 prefixId만 받음, versionId는 adapter 레벨에서 무시
    expect(config.checkFn).toHaveBeenCalledWith(expect.anything(), 'tracking', expect.any(Object));
  });

  it('diagnostics 배열이 그대로 전달됨 (shape 보존)', async () => {
    const diagnostics = [
      { level: 'error' as const, source: 'constraint', id: 'C-1', message: 'a' },
      { level: 'warning' as const, source: 'observation', id: 'OBS-1', message: 'b' },
      { level: 'warning' as const, source: 'domain-health', id: 'C-2', message: 'c' },
    ];

    const config = createMockConfig({
      checkFn: vi.fn().mockReturnValue({ allowed: false, diagnostics, constraintViolations: 1 }),
    });

    const gate = createActivationGate(config);
    const result = await gate.check('x', 'v1');

    expect(result.diagnostics).toEqual(diagnostics);
  });
});
