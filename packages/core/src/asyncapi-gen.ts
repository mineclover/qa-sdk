/**
 * AsyncAPI 명세 생성기 — PipeGraph + ManifestRef → AsyncAPI YAML 문자열
 *
 * 입력: PipeGraph (이벤트 정의) + ManifestRef (서비스 정보)
 * 출력: AsyncAPI 3.0 호환 YAML 문자열
 */

import type { PipeGraph, PipeSpec } from "./types/pipe-spec.js";
import type { ManifestRef } from "./cloud-events.js";

export interface AsyncApiOptions {
  title: string;
  version: string;
  description?: string;
  servers?: Record<string, { url: string; protocol: string }>;
}

export interface AsyncApiSpec {
  asyncapi: "3.0.0";
  info: { title: string; version: string; description?: string };
  servers?: Record<string, { host: string; protocol: string }>;
  channels: Record<string, AsyncApiChannel>;
  operations: Record<string, AsyncApiOperation>;
}

interface AsyncApiChannel {
  address: string;
  messages: Record<string, AsyncApiMessage>;
}

interface AsyncApiMessage {
  payload: {
    type: "object";
    properties: Record<string, { type: string }>;
  };
}

interface AsyncApiOperation {
  action: "send" | "receive";
  channel: { $ref: string };
  summary?: string;
}

/** PipeGraph → AsyncAPI 스펙 객체 생성 */
export function generateAsyncApi(
  graph: PipeGraph,
  manifest: ManifestRef,
  options: AsyncApiOptions,
): AsyncApiSpec {
  const channels: Record<string, AsyncApiChannel> = {};
  const operations: Record<string, AsyncApiOperation> = {};

  // 트리거 이벤트 수집 (receive)
  for (const pipe of graph.pipes) {
    const eventKey = pipe.trigger.eventKey;
    if (!channels[eventKey]) {
      channels[eventKey] = {
        address: eventKey,
        messages: {
          [eventKey]: {
            payload: {
              type: "object",
              properties: extractPayloadFields(pipe),
            },
          },
        },
      };
    }

    operations[`receive_${pipe.pipeId}`] = {
      action: "receive",
      channel: { $ref: `#/channels/${eventKey}` },
      summary: `${pipe.pipeId}가 ${eventKey} 이벤트를 수신`,
    };
  }

  // produces 이벤트 수집 (send)
  for (const pipe of graph.pipes) {
    if (!pipe.produces) continue;
    for (const eventKey of pipe.produces) {
      if (!channels[eventKey]) {
        channels[eventKey] = {
          address: eventKey,
          messages: {
            [eventKey]: {
              payload: { type: "object", properties: {} },
            },
          },
        };
      }

      operations[`send_${pipe.pipeId}_${eventKey}`] = {
        action: "send",
        channel: { $ref: `#/channels/${eventKey}` },
        summary: `${pipe.pipeId}가 ${eventKey} 이벤트를 발행`,
      };
    }
  }

  const spec: AsyncApiSpec = {
    asyncapi: "3.0.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    channels,
    operations,
  };

  if (options.servers) {
    spec.servers = {};
    for (const [name, server] of Object.entries(options.servers)) {
      spec.servers[name] = { host: server.url, protocol: server.protocol };
    }
  }

  return spec;
}

/** AsyncAPI 스펙 → YAML 문자열 (간소화 YAML 직렬화) */
export function asyncApiToYaml(spec: AsyncApiSpec): string {
  const lines: string[] = [];

  lines.push(`asyncapi: '${spec.asyncapi}'`);
  lines.push("info:");
  lines.push(`  title: ${spec.info.title}`);
  lines.push(`  version: '${spec.info.version}'`);
  if (spec.info.description) lines.push(`  description: ${spec.info.description}`);

  if (spec.servers) {
    lines.push("servers:");
    for (const [name, server] of Object.entries(spec.servers)) {
      lines.push(`  ${name}:`);
      lines.push(`    host: ${server.host}`);
      lines.push(`    protocol: ${server.protocol}`);
    }
  }

  lines.push("channels:");
  for (const [name, channel] of Object.entries(spec.channels)) {
    lines.push(`  ${name}:`);
    lines.push(`    address: ${channel.address}`);
    lines.push("    messages:");
    for (const [msgName, msg] of Object.entries(channel.messages)) {
      lines.push(`      ${msgName}:`);
      lines.push("        payload:");
      lines.push("          type: object");
      if (Object.keys(msg.payload.properties).length > 0) {
        lines.push("          properties:");
        for (const [prop, propType] of Object.entries(msg.payload.properties)) {
          lines.push(`            ${prop}:`);
          lines.push(`              type: ${propType.type}`);
        }
      }
    }
  }

  lines.push("operations:");
  for (const [name, op] of Object.entries(spec.operations)) {
    lines.push(`  ${name}:`);
    lines.push(`    action: ${op.action}`);
    lines.push(`    channel:`);
    lines.push(`      $ref: '${op.channel.$ref}'`);
    if (op.summary) lines.push(`    summary: ${op.summary}`);
  }

  return lines.join("\n");
}

/** AsyncAPI 스펙 → JSON 문자열 */
export function asyncApiToJson(spec: AsyncApiSpec): string {
  return JSON.stringify(spec, null, 2);
}

// ── 헬퍼 ─────────────────────────────────────────────

function extractPayloadFields(pipe: PipeSpec): Record<string, { type: string }> {
  const fields: Record<string, { type: string }> = {};

  // dataContract에서 consumes 필드 추출
  if (pipe.flow.kind === "step" && pipe.flow.dataContract?.consumes) {
    for (const [name, spec] of Object.entries(pipe.flow.dataContract.consumes)) {
      fields[name] = { type: spec.type };
    }
  }

  // trigger entryConditions에서 필드 추출
  if (pipe.trigger.entryConditions) {
    for (const cond of pipe.trigger.entryConditions) {
      fields[cond.field] = { type: "string" };
    }
  }

  return fields;
}
