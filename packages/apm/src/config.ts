// @def.boundary observability-system-root
// @def.doc observability-system-root

import type {
  ServiceBootConfig,
  TransmissionOwner,
  TransmissionRuntime,
  ActorContext,
} from "@qa-sdk/core";
import type { QaLoggerConfig, Transport } from "@qa-sdk/sdk";
import type { PrefixCodec } from "weighted-index";

/**
 * ApmLogger 설정.
 *
 * QaLoggerConfig에서 infraContext를 제외하고 (ApmLogger가 자동 생성),
 * PrefixCodec + 고정 차원 + generation 정보를 추가한다.
 */
export interface ApmLoggerConfig extends Omit<QaLoggerConfig, "infraContext"> {
  /** PrefixCodec 인스턴스 (LabelRegistry + prefix 정의 포함) */
  codec: PrefixCodec;

  /** 대상 prefix 이름 (예: "full", "svc", "perm") */
  prefix: string;

  /** SDK 부트 시 고정할 차원 (예: { namespace: "shop", name: "payment", env: "prod" }) */
  fixedDims: Record<string, string>;

  /** GENERATION 상수 (codegen에서 생성) */
  generation?: string;

  /** SnapshotSupply 전략 ID */
  snapshotSupply?: string;

  /** 배포 시점의 entry snapshot ID */
  entrySnapshot?: string;
}

/**
 * ApmLogger 부트 설정 — ServiceBootConfig 기반 편의 인터페이스.
 *
 * ServiceBootConfig 하나로 source, build, fixedDims를 자동 파생한다.
 */
export interface ApmBootConfig {
  /** 통합 서비스 설정 */
  service: ServiceBootConfig;
  /** Transport */
  transport: Transport;
  /** Owner */
  owner: TransmissionOwner;
  /** PrefixCodec 인스턴스 */
  codec: PrefixCodec;
  /** 대상 prefix (default: "service") */
  prefix?: string;
  /** GENERATION 상수 */
  generation?: string;
  /** Runtime 정보 (default: platform "node") */
  runtime?: Partial<TransmissionRuntime>;
  /** Actor 컨텍스트 */
  actor?: ActorContext;
  /** 배포 시점의 entry snapshot ID */
  entrySnapshot?: string;
}
