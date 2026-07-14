/** @def.boundary browser-runtime-system */
import type { BrowserCatalog } from '@qa-sdk/browser-codec';
import type { ServiceBootConfig, TransmissionOwner } from '@qa-sdk/core';

/** QaMonitor의 생명주기 상태 */
export type MonitorStatus = 'active' | 'stopped';

export interface QaMonitorConfig {
  /** ingest-server URL (e.g. "http://localhost:3200") */
  ingestUrl: string;
  /** 통합 서비스 설정. meta보다 우선. */
  serviceConfig?: ServiceBootConfig;
  /** 엔벨로프 소유자. 기본: { owner_type: "tenant", owner_id: "browser-monitor" } */
  owner?: TransmissionOwner;
  /** 시나리오 ID — session_start 이벤트 payload에 포함 */
  scenarioId?: string;
  /** 자동 이벤트 수집 설정 */
  autoCapture?: AutoCaptureConfig;
  /** sessionStorage 키 prefix (default: "qa_monitor") */
  storageKey?: string;
  /** 에러 핸들러 (미지정 시 console.error) */
  onError?: (err: Error, context: string) => void;
  /** @deprecated serviceConfig 사용 */
  meta?: {
    serviceName?: string;
    env?: string;
    version?: string;
  };

  /** 엔벨로프 전체에 적용되는 인프라 주소 컨텍스트 */
  infraContext?: Record<string, string>;

  /** 배포 시점의 entry snapshot ID */
  entrySnapshot?: string;

  /** registry URL. 설정하면 최신 BROWSER_CATALOG를 API에서 fetch (localStorage 캐시). */
  registry?: string;
  /** catalog ID (registry 모드에서 사용, default: "demo") */
  catalogId?: string;
  /** registry/테스트에서 주입하는 브라우저 좌표 catalog. */
  catalog?: BrowserCatalog;
}

export interface AutoCaptureConfig {
  /** button, a, [data-qa-event] 클릭 자동 수집 */
  clicks?: boolean;
  /** form submit 자동 수집 */
  forms?: boolean;
  /** history.pushState / popstate 네비게이션 자동 수집 */
  navigation?: boolean;
}

export interface MonitorSession {
  sessionId: string;
  traceId: string;
}
