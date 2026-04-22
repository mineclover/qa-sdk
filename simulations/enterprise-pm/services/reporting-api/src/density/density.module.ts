// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import {
  Module,
  type DynamicModule,
  type FactoryProvider,
} from "@nestjs/common";
import { DensityController } from "./density.controller.js";
import {
  DENSITY_OPTIONS,
  MarginalDensityService,
  type MarginalDensityServiceOptions,
} from "./density.service.js";

export interface DensityModuleOptions {
  /** DENSITY_OPTIONS 생성 factory — ingest store / prefix catalog / threshold 주입. */
  useFactory: (
    ...deps: unknown[]
  ) => Promise<MarginalDensityServiceOptions> | MarginalDensityServiceOptions;
  /** factory가 주입받을 Nest 토큰 목록 (옵션). */
  inject?: FactoryProvider["inject"];
}

/**
 * DensityModule — GET /density endpoint + MarginalDensityService DI.
 *
 * register({ useFactory }) 로 호출자 측에서 options 주입 방식을 결정한다.
 * 기본 app.module 조립에서는 DB 기반 ingest store factory를 전달한다.
 */
@Module({})
export class DensityModule {
  static register(opts: DensityModuleOptions): DynamicModule {
    return {
      module: DensityModule,
      controllers: [DensityController],
      providers: [
        MarginalDensityService,
        {
          provide: DENSITY_OPTIONS,
          useFactory: opts.useFactory,
          inject: opts.inject,
        },
      ],
      exports: [MarginalDensityService],
    };
  }
}
