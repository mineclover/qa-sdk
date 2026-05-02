// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { ReportReadModel } from "../../domain/report.types.js";
import type {
  CreateReportCommand,
  DeleteReportCommand,
  UpdateReportCommand,
} from "../commands/upsert-report.command.js";

/**
 * Report admin port — 카탈로그 항목 CRUD.
 *
 * Read-model 슬라이스의 control-plane write surface. 트랜잭션·outbox 없음 —
 * 본 슬라이스는 이벤트 emit 도, 외부 read-model projector 도 갖지 않는다.
 * 어댑터는 infrastructure/persistence 에서 기존 ReportingRepository 를 wrapping.
 */
export abstract class ReportAdminPort {
  abstract create(cmd: CreateReportCommand): Promise<ReportReadModel>;
  abstract update(cmd: UpdateReportCommand): Promise<ReportReadModel>;
  abstract delete(cmd: DeleteReportCommand): Promise<void>;
}
