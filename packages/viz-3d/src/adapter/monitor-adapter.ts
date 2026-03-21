/**
 * MonitorAdapter — ingest-server WebSocket/HTTP 연결 + decode → 셀 키 매핑.
 *
 * Three.js에 의존하지 않는 어댑터.
 * 이벤트를 수신하면 콜백으로 셀 키 목록을 전달한다.
 */

export interface DecodeFn {
  (serialized: string): { prefix: string; values: Record<string, string | number> } | null;
}

export interface CellKeyMapper {
  (prefix: string, values: Record<string, string | number>): string[];
}

export interface AdapterConfig {
  decode: DecodeFn;
  mapToKeys: CellKeyMapper;
  onActivation: (keys: string[], raw: Record<string, string>) => void;
  onConnectionChange?: (status: string) => void;
}

export class MonitorAdapter {
  private ws: WebSocket | null = null;
  private _connected = false;

  constructor(private config: AdapterConfig) {}

  get connected(): boolean { return this._connected; }

  /** WebSocket 연결 */
  connect(url: string): void {
    this.config.onConnectionChange?.("connecting");
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this._connected = true;
        this.config.onConnectionChange?.("connected");
        this.ws!.send(JSON.stringify({ type: "subscribe", scenarioId: "*" }));
      };
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "record" && msg.data) {
            this.handleRecord(msg.data);
          } else if (msg.type === "subscribed") {
            this.config.onConnectionChange?.("subscribed");
          }
        } catch {}
      };
      this.ws.onerror = () => {
        this.config.onConnectionChange?.("error");
      };
      this.ws.onclose = () => {
        this._connected = false;
        this.config.onConnectionChange?.("disconnected");
      };
    } catch {
      this.config.onConnectionChange?.("failed");
    }
  }

  disconnect(): void {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this._connected = false;
    this.config.onConnectionChange?.("disconnected");
  }

  /** HTTP로 이벤트 전송 (DEMO용) */
  async sendToIngest(url: string, addressContext: Record<string, string>, eventKey: string, traceId: string, spanSeq: number): Promise<void> {
    const now = new Date().toISOString();
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transmission_id: `tx_${Date.now()}`,
          sent_at: now,
          owner: { owner_type: "workspace", owner_id: "viz-3d" },
          source: { service_name: "viz-3d", sdk_name: "@qa-sdk/viz-3d", sdk_version: "0.1.0" },
          runtime: { platform: "browser" },
          build: { env: "dev" },
          records: [{
            log_id: `l_${Date.now()}_${spanSeq}`,
            timestamp: now,
            record_kind: "log",
            trace_id: traceId,
            span_id: `s_${spanSeq}`,
            event_key: eventKey,
            event_version: "001",
            payload_format: "json",
            payload_encoding: "raw",
            payload_masking_applied: false,
            payload_masked_fields: [],
            payload: { step: eventKey },
            address_context: addressContext,
          }],
        }),
      });
    } catch {}
  }

  private handleRecord(record: any): void {
    const ctx = record.addressContext || record.address_context;
    if (!ctx || Object.keys(ctx).length === 0) return;

    const allKeys: string[] = [];
    for (const [, serialized] of Object.entries(ctx)) {
      const decoded = this.config.decode(serialized as string);
      if (!decoded) continue;
      const keys = this.config.mapToKeys(decoded.prefix, decoded.values);
      allKeys.push(...keys);
    }

    if (allKeys.length > 0) {
      this.config.onActivation(allKeys, ctx as Record<string, string>);
    }
  }
}

// ═══════════════════════════════════════════════════
//  Default Key Mapper
// ═══════════════════════════════════════════════════

/** 기본 prefix → 셀 키 매핑 */
export function defaultKeyMapper(prefix: string, values: Record<string, string | number>): string[] {
  const keys: string[] = [];

  if (prefix === "flow_point" && values.flow_name && values.flow_step) {
    keys.push(`flow_point/${values.flow_name}/${values.flow_step}`);
  } else if (prefix === "endpoint" && values.http_method && values.resource_type) {
    keys.push(`endpoint/${values.http_method}/${values.resource_type}`);
  } else if (prefix === "service" && values.svc_name) {
    const sn = String(values.svc_name).replace("shopping-", "");
    keys.push(`service/${sn}`);
  } else {
    for (const v of Object.values(values)) {
      if (typeof v === "string") keys.push(`${prefix}/${v}`);
    }
  }

  return keys;
}
