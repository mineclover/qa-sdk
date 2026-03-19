/** QaMonitor의 생명주기 상태 */
export type MonitorStatus = "active" | "stopped";

export interface QaMonitorConfig {
  /** ingest-server URL (e.g. "http://localhost:3100") */
  ingestUrl: string;
  /** 시나리오 ID — session_start 이벤트 payload에 포함 */
  scenarioId?: string;
  /** 자동 이벤트 수집 설정 */
  autoCapture?: AutoCaptureConfig;
  /** sessionStorage 키 prefix (default: "qa_monitor") */
  storageKey?: string;
  /** 에러 핸들러 (미지정 시 console.error) */
  onError?: (err: Error, context: string) => void;
  /** 서비스/환경 메타 */
  meta?: {
    serviceName?: string;
    env?: string;
    version?: string;
  };

  /** 엔벨로프 전체에 적용되는 인프라 주소 컨텍스트 */
  infraContext?: Record<string, string>;

  /** 배포 시점의 entry snapshot ID */
  entrySnapshot?: string;
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
