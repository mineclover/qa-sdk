// @def.boundary registry-system
// @def.doc registry-system

/**
 * post-activation-hook — 버전 활성화 성공 후 DKG 기록.
 *
 * VersionEventNode 자동 생성 + DKG store 저장.
 * fire-and-forget 패턴: 활성화 응답을 지연시키지 않음.
 * spec-core 동적 import로 정적 의존 없음.
 */

import type { Logger } from 'pino';

export interface PostActivationHookConfig {
  /** DkgSqliteStore (optional) */
  dkgStore?: {
    saveNodes(
      nodes: readonly unknown[],
      edges: readonly { type: string; from: string; to: string; meta?: Record<string, unknown> }[],
      source: string,
    ): void;
    setMeta(key: string, value: string): void;
  };
  logger?: Logger;
}

export interface PostActivationInput {
  prefix: string;
  versionId: string;
  previousVersion: string | null;
}

/**
 * post-activation hook 실행.
 *
 * 1. VersionEventNode 생성
 * 2. DKG store 저장 (source: "auto")
 * 3. 메타 업데이트
 *
 * 에러가 발생해도 throw하지 않음 — 로그만 남김.
 */
export async function runPostActivationHook(
  input: PostActivationInput,
  config: PostActivationHookConfig,
): Promise<void> {
  try {
    const now = new Date().toISOString().slice(0, 10);

    // VersionEventNode 직접 생성 (activation 시점에는 diff 데이터 없음)
    const node = {
      kind: 'version-event' as const,
      id: `VE-${input.prefix}-${input.previousVersion ?? 'none'}-${input.versionId}`,
      subjectId: input.prefix,
      subjectKind: 'prefix' as const,
      fromVersion: input.previousVersion,
      toVersion: input.versionId,
      date: now,
      changes: [
        {
          kind: 'activated' as const,
          detail: `${input.prefix} ${input.previousVersion ?? '(new)'} → ${input.versionId}`,
        },
      ],
      impact: 'activation. 스트라이드 변경 없음.',
    };

    if (config.dkgStore) {
      // prefix 노드에 evolves 엣지 연결
      const edges: { type: string; from: string; to: string }[] = [
        { type: 'evolves', from: node.id, to: input.prefix },
      ];

      config.dkgStore.saveNodes([node], edges, 'auto');
      config.dkgStore.setMeta('last_activation', now);

      config.logger?.info(
        {
          prefix: input.prefix,
          versionId: input.versionId,
          veNodeId: node.id,
        },
        'post-activation hook: VersionEvent recorded',
      );
    } else {
      config.logger?.debug(
        { prefix: input.prefix, versionId: input.versionId },
        'post-activation hook: no DKG store configured, skipping persistence',
      );
    }
  } catch (error) {
    config.logger?.error(
      { err: error, prefix: input.prefix, versionId: input.versionId },
      'post-activation hook failed',
    );
  }
}

/**
 * post-activation hook 팩토리.
 * 서버 시작 시 한 번 생성하여 RegistryService에 주입.
 */
export function createPostActivationHook(config: PostActivationHookConfig) {
  return {
    async run(input: PostActivationInput): Promise<void> {
      await runPostActivationHook(input, config);
    },
  };
}
