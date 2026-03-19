import type {
  DlqStore,
  EventRecord,
  GraphStore,
  RecordStore,
  StoredRecord,
  StoredTrace,
  TraceStore,
} from "@qa-sdk/core";
import { newDlqId } from "@qa-sdk/core";
import { reconstruct } from "../reconstruction/reconstruct.js";

export interface ReconstructPendingTracesDeps {
  recordStore: Pick<RecordStore, "findByTraceId">;
  traceStore: Pick<TraceStore, "findById" | "findUnreconstructed" | "markReconstructed">;
  graphStore: GraphStore;
  dlqStore: Pick<DlqStore, "insert">;
}

export interface ReconstructPendingTracesOptions {
  captureFailuresInDlq?: boolean;
  limit?: number;
  onError?: (traceId: string, error: unknown) => void;
  traceIds?: string[];
}

export interface ReconstructPendingTracesResult {
  reconstructedTraceIds: string[];
  failedTraceIds: string[];
}

export async function reconstructPendingTraces(
  deps: ReconstructPendingTracesDeps,
  options: ReconstructPendingTracesOptions = {},
): Promise<ReconstructPendingTracesResult> {
  const traces = await findTracesToReconstruct(deps.traceStore, options);
  const reconstructedTraceIds: string[] = [];
  const failedTraceIds: string[] = [];

  for (const trace of traces) {
    try {
      await reconstructTrace(deps, trace.traceId);
      reconstructedTraceIds.push(trace.traceId);
    } catch (error) {
      failedTraceIds.push(trace.traceId);
      if (options.captureFailuresInDlq !== false) {
        await deps.dlqStore.insert({
          id: newDlqId(),
          traceId: trace.traceId,
          phase: "reconstruction",
          errorMessage: toErrorMessage(error),
        });
      }
      options.onError?.(trace.traceId, error);
    }
  }

  return {
    reconstructedTraceIds,
    failedTraceIds,
  };
}

export async function reconstructTrace(
  deps: Pick<ReconstructPendingTracesDeps, "recordStore" | "traceStore" | "graphStore">,
  traceId: string,
): Promise<void> {
  const [records, trace] = await Promise.all([
    deps.recordStore.findByTraceId(traceId),
    deps.traceStore.findById(traceId),
  ]);

  const graph = reconstruct(traceId, records.map(toEventRecord), {
    serviceName: trace?.serviceName ?? undefined,
  });

  await deps.graphStore.upsert(traceId, graph);
  await deps.traceStore.markReconstructed(traceId);
}

async function findTracesToReconstruct(
  traceStore: Pick<
    ReconstructPendingTracesDeps["traceStore"],
    "findById" | "findUnreconstructed"
  >,
  options: ReconstructPendingTracesOptions,
): Promise<StoredTrace[]> {
  if (!options.traceIds) {
    return traceStore.findUnreconstructed(options.limit);
  }

  const traces: StoredTrace[] = [];
  const seenTraceIds = new Set<string>();

  for (const traceId of options.traceIds) {
    if (seenTraceIds.has(traceId)) {
      continue;
    }

    seenTraceIds.add(traceId);

    const trace = await traceStore.findById(traceId);
    if (!trace || trace.reconstructed) {
      continue;
    }

    traces.push(trace);
  }

  return traces;
}

function toEventRecord(record: StoredRecord): EventRecord {
  return {
    log_id: record.logId,
    timestamp: record.timestamp.toISOString(),
    record_kind: record.recordKind as EventRecord["record_kind"],
    trace_id: record.traceId,
    span_id: record.spanId,
    parent_span_id: record.parentSpanId,
    event_key: record.eventKey,
    event_version: record.eventVersion,
    span_name: record.spanName,
    start_time: record.startTime?.toISOString(),
    end_time: record.endTime?.toISOString(),
    status_code: record.statusCode as EventRecord["status_code"],
    payload_format: record.payloadFormat as EventRecord["payload_format"],
    payload_encoding: record.payloadEncoding as EventRecord["payload_encoding"],
    payload_masking_applied: record.payloadMaskingApplied,
    payload_masked_fields: [...record.payloadMaskedFields],
    payload: structuredClone(record.payload),
    qa_session_id: record.qaSessionId,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
