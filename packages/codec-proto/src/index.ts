// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * @qa-sdk/codec-proto — Protobuf 인코딩/디코딩 + Transport.
 *
 * JSON TransmissionEnvelope ↔ Protobuf 바이너리 변환.
 * 기존 JSON 인프라와 완전 호환 — Content-Type으로 분기.
 */
export { encodeEnvelope, decodeEnvelope } from "./codec.js";
export { ProtoTransport } from "./transport.js";
export type { ProtoTransportOptions } from "./transport.js";
