import { QaLogger, TraceContext } from "@qa-sdk/sdk";
import type { MetricType } from "@qa-sdk/core";
import { toTransmissionSource, toTransmissionBuild } from "@qa-sdk/core";
import { getCoreEvent } from "@qa-sdk/event-catalog";
import { BeaconTransport } from "./transport.js";
import { getOrCreateSession, clearSession } from "./session.js";
import { createAutoCapture } from "./auto-capture.js";
import type { QaMonitorConfig, MonitorSession, MonitorStatus } from "./types.js";

/**
 * QaMonitor — 브라우저 모니터링 SDK 진입점.
 *
 * ## 생명주기 상태
 *
 *   ACTIVE  ──emit()──────────────→  ACTIVE  (버퍼 축적)
 *           ──flush()─────────────→  ACTIVE  (버퍼 전송)
 *           ──newSession()────────→  ACTIVE  (세션 교체)
 *           ──pagehide────────────→  ACTIVE  (flush fire-and-forget)
 *           ──shutdown()──────────→  STOPPED (리스너 제거, 버퍼 전송, 타이머 정리)
 *
 *   STOPPED ──emit()──────────────→  STOPPED (무시 + warn)
 *           ──shutdown()──────────→  STOPPED (no-op, 멱등)
 *           ──newSession()────────→  STOPPED (무시 + warn)
 *           ──flush()─────────────→  STOPPED (no-op)
 */
export class QaMonitor {
  private readonly logger: QaLogger;
  private session: MonitorSession;
  private readonly storageKey: string;
  private destroyAutoCapture: (() => void) | null = null;
  private readonly unloadHandler: () => void;
  private _status: MonitorStatus = "active";

  constructor(config: QaMonitorConfig) {
    this.storageKey = config.storageKey ?? "qa_monitor";
    this.session = getOrCreateSession(this.storageKey);

    const transport = new BeaconTransport(`${config.ingestUrl}/v1/ingest`);

    const svc = config.serviceConfig;
    const source = svc
      ? toTransmissionSource(svc, "@qa-sdk/browser", "0.1.0")
      : { service_name: config.meta?.serviceName ?? "browser", sdk_name: "@qa-sdk/browser", sdk_version: "0.1.0" };
    const build = svc
      ? toTransmissionBuild(svc)
      : { env: config.meta?.env ?? "production" };

    this.logger = new QaLogger({
      transport,
      owner: config.owner ?? { owner_type: "tenant", owner_id: "browser-monitor" },
      source,
      runtime: {
        platform: "browser",
        os_version: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      },
      build,
      flushIntervalMs: 5_000,
      onError: config.onError,
      ...(config.infraContext ? { infraContext: config.infraContext } : {}),
      ...(config.entrySnapshot ? { entrySnapshot: config.entrySnapshot } : {}),
    });

    // 세션 컨텍스트 연결
    const ctx = new TraceContext({
      trace_id: this.session.traceId,
      qa_session_id: this.session.sessionId,
    });
    this.logger.setContext(ctx);

    // 시나리오 시작 이벤트
    if (config.scenarioId) {
      this.emit("session_start", { scenario_id: config.scenarioId });
    }

    // 자동 수집
    if (config.autoCapture) {
      this.destroyAutoCapture = createAutoCapture(config.autoCapture, (key, payload) => {
        this.emit(key, payload);
      });
    }

    // 페이지 언로드 시 flush (fire-and-forget — 페이지 닫힘 타이밍이므로 await 불가)
    this.unloadHandler = () => {
      this.logger.flush().catch(() => {});
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", this.unloadHandler);
    }
  }

  // ── 상태 조회 ───────────────────────────────────────────

  /** 현재 생명주기 상태 */
  get status(): MonitorStatus {
    return this._status;
  }

  /** 이벤트 수집 가능 여부 */
  get isActive(): boolean {
    return this._status === "active";
  }

  // ── 이벤트 발생 ─────────────────────────────────────────

  /**
   * 수동 이벤트 발생.
   * event-catalog에 등록된 event_key면 버전을 자동으로 조회한다.
   * stopped 상태에서는 경고 후 무시된다.
   */
  emit(eventKey: string, payload?: Record<string, unknown>, options?: { address_context?: Record<string, string> }): void {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] emit("${eventKey}") called after shutdown — event dropped`);
      return;
    }
    const def = getCoreEvent(eventKey);
    const version = (def?.event_version ?? "1").padStart(3, "0");
    this.logger.log({
      event_key: eventKey,
      event_version: version,
      payload,
      ...(options?.address_context ? { address_context: options.address_context } : {}),
    });
  }

  // ── 메트릭 ─────────────────────────────────────────────

  /**
   * 메트릭 이벤트 기록. QaLogger.metric() 위임.
   * stopped 상태에서는 경고 후 무시.
   */
  metric(name: string, value: number, opts?: {
    type?: MetricType;
    unit?: string;
    labels?: Record<string, string>;
  }): void {
    if (this._status === "stopped") {
      console.warn(`[QaMonitor] metric("${name}") called after shutdown — event dropped`);
      return;
    }
    this.logger.metric(name, value, opts);
  }

  // ── 세션 관리 ───────────────────────────────────────────

  /** 현재 세션 정보 반환 (복사본) */
  getSession(): MonitorSession {
    return { ...this.session };
  }

  /**
   * 세션을 초기화하고 새로운 sessionId / traceId를 발급한다.
   * stopped 상태에서는 경고 후 현재 세션을 반환한다.
   */
  newSession(): MonitorSession {
    if (this._status === "stopped") {
      console.warn("[QaMonitor] newSession() called after shutdown — ignored");
      return { ...this.session };
    }
    clearSession(this.storageKey);
    const fresh = getOrCreateSession(this.storageKey);
    const ctx = new TraceContext({
      trace_id: fresh.traceId,
      qa_session_id: fresh.sessionId,
    });
    this.logger.setContext(ctx);
    this.session = fresh;
    return fresh;
  }

  // ── 전송 제어 ───────────────────────────────────────────

  /**
   * 버퍼에 쌓인 이벤트를 즉시 전송.
   * stopped 상태에서는 no-op (이미 shutdown에서 flush 완료).
   * 전송 실패 시 throw.
   */
  async flush(): Promise<void> {
    if (this._status === "stopped") return;
    await this.logger.flush();
  }

  /**
   * ACTIVE → STOPPED 전환.
   * autoCapture 리스너 제거, pagehide 리스너 제거,
   * 남은 버퍼를 전송한 뒤 QaLogger 타이머 정리.
   * 멱등 — 이미 stopped이면 즉시 반환.
   */
  async shutdown(): Promise<void> {
    if (this._status === "stopped") return;
    this._status = "stopped";

    this.destroyAutoCapture?.();
    this.destroyAutoCapture = null;

    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.unloadHandler);
    }

    await this.logger.shutdown();
  }
}

export function createQaMonitor(config: QaMonitorConfig): QaMonitor {
  return new QaMonitor(config);
}
