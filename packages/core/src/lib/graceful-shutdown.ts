// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 서비스 공용 graceful shutdown 핸들러 (단순 버전).
 *
 * ingest-server처럼 복잡한 정리가 필요한 경우 자체 구현 사용.
 */

import type { LogMethod } from 'pino';

/** `@hono/node-server`의 `serve()`가 반환하는 ServerType 호환 */
interface Closeable {
  close(callback?: (err?: Error) => void): unknown;
}

export interface SimpleShutdownDeps {
  server: Closeable;
  logger: { info: LogMethod; error: LogMethod };
  /** 서버 종료 전 추가 정리 작업 (DB 연결 해제 등) */
  cleanup?: () => Promise<void>;
}

export function installSimpleShutdown(deps: SimpleShutdownDeps) {
  function shutdown(signal: string) {
    deps.logger.info({ signal }, 'shutdown requested');
    deps.server.close(async () => {
      try {
        await deps.cleanup?.();
      } catch (err) {
        deps.logger.error({ err }, 'error during shutdown cleanup');
        process.exit(1);
      }
      deps.logger.info('shutdown complete');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
