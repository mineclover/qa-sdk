// @def.boundary definition-service-system
/**
 * NestJS 통합 모듈
 *
 * 다른 NestJS 서비스에서 definition-service에 접근할 때 사용:
 *
 * ```typescript
 * @Module({
 *   imports: [DefinitionModule.forRoot({ baseUrl: "http://localhost:3700" })],
 * })
 * export class AppModule {}
 *
 * @Injectable()
 * export class MyService {
 *   constructor(@Inject(DefinitionClient) private readonly def: DefinitionClient) {}
 *
 *   async checkIntent(prefixId: string, dims: Record<string, string>) {
 *     const { matched } = await this.def.resolveIntents(prefixId, dims);
 *     return matched;
 *   }
 * }
 * ```
 */

import { Module, type DynamicModule, type InjectionToken } from '@nestjs/common';
import { DefinitionClient, type DefinitionClientOptions } from './client.js';

/** DI 토큰 */
export const DEFINITION_CLIENT = 'DEFINITION_CLIENT';
export const DEFINITION_CLIENT_OPTIONS = 'DEFINITION_CLIENT_OPTIONS';

/** forRoot 옵션 */
export interface DefinitionModuleOptions {
  /** definition-service base URL */
  baseUrl: string;
  /** 요청 타임아웃 ms (기본: 5000) */
  timeoutMs?: number;
  /** fetch 구현 (기본: globalThis.fetch) */
  fetch?: typeof fetch;
}

@Module({})
export class DefinitionModule {
  /**
   * 루트 모듈에서 1회 등록.
   *
   * ```typescript
   * DefinitionModule.forRoot({ baseUrl: "http://localhost:3700" })
   * ```
   */
  static forRoot(options: DefinitionModuleOptions): DynamicModule {
    return {
      module: DefinitionModule,
      global: true,
      providers: [
        {
          provide: DEFINITION_CLIENT_OPTIONS,
          useValue: options,
        },
        {
          provide: DEFINITION_CLIENT,
          useFactory: (opts: DefinitionClientOptions) => new DefinitionClient(opts),
          inject: [DEFINITION_CLIENT_OPTIONS],
        },
        {
          // DefinitionClient 클래스 자체도 토큰으로 등록 (타입 기반 주입 지원)
          provide: DefinitionClient,
          useExisting: DEFINITION_CLIENT,
        },
      ],
      exports: [DEFINITION_CLIENT, DefinitionClient],
    };
  }

  /**
   * 비동기 옵션 (ConfigService 등에서 URL 주입).
   *
   * ```typescript
   * DefinitionModule.forRootAsync({
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     baseUrl: config.get("DEFINITION_SERVICE_URL"),
   *   }),
   * })
   * ```
   */
  static forRootAsync(asyncOptions: {
    inject?: InjectionToken[];
    useFactory: (...args: unknown[]) => DefinitionModuleOptions | Promise<DefinitionModuleOptions>;
  }): DynamicModule {
    return {
      module: DefinitionModule,
      global: true,
      providers: [
        {
          provide: DEFINITION_CLIENT_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
        {
          provide: DEFINITION_CLIENT,
          useFactory: (opts: DefinitionClientOptions) => new DefinitionClient(opts),
          inject: [DEFINITION_CLIENT_OPTIONS],
        },
        {
          provide: DefinitionClient,
          useExisting: DEFINITION_CLIENT,
        },
      ],
      exports: [DEFINITION_CLIENT, DefinitionClient],
    };
  }
}
