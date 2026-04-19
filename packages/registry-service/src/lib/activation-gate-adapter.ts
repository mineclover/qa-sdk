// @def.boundary registry-system
// @def.doc registry-system

/**
 * activation-gate-adapter — spec-core의 checkActivationReadiness를 RegistryService에 연결.
 *
 * spec-core에 대한 정적 의존 없이 ActivationGatePort 인터페이스로 추상화한다.
 * 제네릭 <G>로 graph 타입을 캡슐화하여 강한 타입 경계를 유지한다.
 */

export interface ActivationGatePort {
  check(prefix: string, versionId: string): Promise<ActivationGateAdapterResult>;
}

export interface ActivationGateAdapterResult {
  readonly allowed: boolean;
  readonly diagnostics: readonly ActivationGateDiagnostic[];
}

export interface ActivationGateDiagnostic {
  readonly level: "error" | "warning" | "info";
  readonly source: string;
  readonly id: string;
  readonly message: string;
}

export interface ActivationGateConfig<G = unknown> {
  mode: "strict" | "warn";
  graphProvider: () => G;
  checkFn: (graph: G, prefixId: string, options?: { mode?: "strict" | "warn"; schemaCheck?: boolean }) => {
    allowed: boolean;
    diagnostics: readonly ActivationGateDiagnostic[];
  };
  /** schema category 검증 포함 여부 (default: true) */
  schemaCheck?: boolean;
}

export function createActivationGate<G>(config: ActivationGateConfig<G>): ActivationGatePort {
  return {
    async check(prefix: string, _versionId: string): Promise<ActivationGateAdapterResult> {
      try {
        const graph = config.graphProvider();
        const result = config.checkFn(graph, prefix, {
          mode: config.mode,
          schemaCheck: config.schemaCheck ?? true,
        });
        return {
          allowed: result.allowed,
          diagnostics: result.diagnostics,
        };
      } catch (error) {
        // Gate failure → fail open (allow, with warning)
        return {
          allowed: true,
          diagnostics: [{
            level: "warning",
            source: "gate-error",
            id: "GATE_ERROR",
            message: `Activation gate check failed: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    },
  };
}
