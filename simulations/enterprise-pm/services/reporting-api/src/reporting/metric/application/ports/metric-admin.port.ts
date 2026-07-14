// @def.boundary sim-reporting-api
// @def.doc domain-slice-architecture

import type { DailyMetricReadModel } from '../../domain/metric.types.js';
import type { RecordMetricCommand } from '../commands/record-metric.command.js';

/**
 * Metric admin port — 시계열 record 적재.
 *
 * Read-model 슬라이스의 control-plane write surface. 트랜잭션·outbox 없음.
 * 어댑터는 infrastructure/persistence 에서 기존 ReportingRepository.recordMetric
 * 위에 wrapping.
 */
export abstract class MetricAdminPort {
  abstract record(cmd: RecordMetricCommand): Promise<DailyMetricReadModel>;
}
