import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import { DashboardExceptionFilter } from "./dashboard.exception-filter.js";
import { DashboardService } from "./dashboard.service.js";

@UseFilters(new DashboardExceptionFilter())
@Controller()
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Header("content-type", "text/html; charset=utf-8")
  @Get("dev")
  html(): string {
    return this.dashboard.getHtml();
  }

  @Get("dev/api/overview")
  devOverview(): unknown {
    return this.dashboard.getOverview();
  }

  @Get("dev/api/flow-map")
  devFlowMap(): unknown {
    return this.dashboard.getFlowMap();
  }

  @Get("dev/api/metrics")
  devMetrics(): unknown {
    return this.dashboard.getMetrics();
  }

  @Get("dev/api/timeline")
  devTimeline(@Query("limit") limit?: string): unknown {
    return this.dashboard.getTimeline(parseLimit(limit));
  }

  @HttpCode(200)
  @Post("dev/api/refresh")
  refresh(): unknown {
    return this.dashboard.refresh();
  }

  @Get("dev/api/catalogs")
  listCatalogs(): Promise<unknown> {
    return this.dashboard.listCatalogs();
  }

  @Get("dev/api/service-control-plane/:serviceId/candidates")
  serviceCandidatesDev(
    @Query("catalog") catalogId: string | undefined,
    @Param("serviceId") serviceId: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceAssemblyCandidates(serviceId, catalogId ?? "demo");
  }

  @Get("dev/api/service-control-plane/:serviceId/warnings")
  serviceWarningsDev(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceWarnings(serviceId, { catalogId, manifestVersion });
  }

  @Get("dev/api/service-control-plane/:serviceId/cleanup-plan")
  serviceCleanupPlanDev(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceCleanupPlan(serviceId, { catalogId, manifestVersion });
  }

  @Get("api/dashboard/overview")
  overview(): unknown {
    return this.dashboard.getOverview();
  }

  @Get("api/dashboard/flow-map")
  flowMap(): unknown {
    return this.dashboard.getFlowMap();
  }

  @Get("api/dashboard/metrics")
  metrics(): unknown {
    return this.dashboard.getMetrics();
  }

  @Get("api/dashboard/timeline")
  timeline(@Query("limit") limit?: string): unknown {
    return this.dashboard.getTimeline(parseLimit(limit));
  }

  @Get("api/dashboard/service-control-plane/:serviceId/candidates")
  serviceCandidates(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceAssemblyCandidates(serviceId, catalogId ?? "demo");
  }

  @Get("api/dashboard/service-control-plane/:serviceId/warnings")
  serviceWarnings(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceWarnings(serviceId, { catalogId, manifestVersion });
  }

  @Get("api/dashboard/service-control-plane/:serviceId/cleanup-plan")
  serviceCleanupPlan(
    @Param("serviceId") serviceId: string,
    @Query("catalog") catalogId?: string,
    @Query("manifestVersion") manifestVersion?: string,
  ): Promise<unknown> {
    return this.dashboard.getServiceCleanupPlan(serviceId, { catalogId, manifestVersion });
  }

  @Get("api/dashboard/schema")
  schema(): unknown {
    return this.dashboard.getSchema();
  }

  @HttpCode(200)
  @Post("api/dashboard/collect")
  collect(): Promise<unknown> {
    return this.dashboard.collect();
  }
}

function parseLimit(limit?: string) {
  if (!limit) return 30;
  const parsed = Number.parseInt(limit, 10);
  return Number.isNaN(parsed) ? 30 : parsed;
}
