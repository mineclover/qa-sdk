/**
 * Flow Ingest Emitter — 의사결정 이벤트를 ingest-server로 전송.
 *
 * FlowEngineListener를 구현하여, gate 선택 / 플로우 완료 시
 * ingest-server의 /v1/ingest로 이벤트를 전송한다.
 *
 * 전송 실패해도 flow 진행을 차단하지 않는다 (fail-open).
 * 서버가 localhost:3200이든 prod 서버든 동일한 경로.
 *
 * 환경변수:
 *   INGEST_URL — ingest-server URL (기본: http://localhost:3200)
 */

import { createServiceBootConfig, toTransmissionSource } from "@qa-sdk/core";
import type { FlowEngineListener } from "decision-flow";
import type { FlowInstance, GateSchema, GateSelection } from "decision-flow";

const DEFAULT_INGEST_URL = "http://localhost:3200";

export interface FlowIngestEmitterConfig {
  /** ingest-server URL. 기본: INGEST_URL 환경변수 또는 http://localhost:3200 */
  readonly ingestUrl?: string;
  /** 전송 실패 시 콘솔 경고 출력 여부. 기본: true */
  readonly warnOnFailure?: boolean;
}

/**
 * 의사결정 이벤트를 ingest-server로 전송하는 리스너.
 *
 * 사용:
 *   const emitter = new FlowIngestEmitter();
 *   engine.addListener(emitter);
 */
export class FlowIngestEmitter implements FlowEngineListener {
  private readonly ingestUrl: string;
  private readonly warnOnFailure: boolean;
  private readonly serviceConfig = createServiceBootConfig("qa-sdk-cli");
  private readonly source = toTransmissionSource(this.serviceConfig, "decision-flow", "0.1.0");

  constructor(config: FlowIngestEmitterConfig = {}) {
    this.ingestUrl = config.ingestUrl ?? process.env.INGEST_URL ?? DEFAULT_INGEST_URL;
    this.warnOnFailure = config.warnOnFailure ?? true;
  }

  onGateSelected(instance: FlowInstance, selection: GateSelection, gate: GateSchema): void {
    const addressContext = instance.addressContext ?? {};
    this.sendEvent(
      `flow.gate.${gate.id}`,
      {
        schemaId: instance.schemaId,
        instanceId: instance.id,
        gateId: gate.id,
        branchId: selection.branchId,
        confidence: selection.confidence,
        weight: gate.weight ?? "tactical",
        evidenceKinds: selection.evidence.map((e) => e.kind),
        durationMs: selection.durationMs,
      },
      addressContext,
      instance.context,
    );
  }

  onFlowCompleted(instance: FlowInstance): void {
    const addressContext = instance.addressContext ?? {};
    this.sendEvent(
      `flow.completed.${instance.schemaId}`,
      {
        schemaId: instance.schemaId,
        instanceId: instance.id,
        coordinateAddress: instance.coordinateAddress,
        selectionCount: instance.selections.length,
        outcome: instance.outcome,
      },
      addressContext,
      instance.context,
    );
  }

  private sendEvent(
    eventKey: string,
    payload: Record<string, unknown>,
    addressContext: Record<string, string>,
    context: Record<string, unknown>,
  ): void {
    const traceId = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const envelope = {
      source: this.source,
      build: { env: this.serviceConfig.env },
      records: [{
        trace_id: traceId,
        event_key: eventKey,
        timestamp: new Date().toISOString(),
        address_context: addressContext,
        infra_context: {
          env: this.serviceConfig.env,
          region: this.serviceConfig.region,
          svc_name: this.serviceConfig.name,
          namespace: this.serviceConfig.namespace,
        },
        payload_format: "json" as const,
        payload_encoding: "raw" as const,
        payload_masking_applied: false,
        payload_masked_fields: [] as string[],
        payload: { ...payload, flow_context: context },
        qa_session_id: `flow-${this.serviceConfig.name}`,
      }],
    };

    // 비동기 전송 — 결과를 기다리지 않음 (fail-open)
    fetch(`${this.ingestUrl}/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(3_000),
    }).catch((err) => {
      if (this.warnOnFailure) {
        console.warn(`[flow-ingest] 전송 실패 (${this.ingestUrl}): ${err instanceof Error ? err.message : err}`);
      }
    });
  }
}
