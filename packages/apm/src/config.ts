import type { QaLoggerConfig } from "@qa-sdk/sdk";
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
