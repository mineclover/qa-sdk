// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── Payload Format ──────────────────────────────────────

export type PayloadFormat = 'json' | 'rpc' | 'protobuf' | 'text' | 'binary' | 'stream';

export type PayloadEncoding = 'raw' | 'base64' | 'gzip+base64' | 'protobuf';

// ── Masking ─────────────────────────────────────────────

export type MaskingMode = 'raw' | 'mask' | 'drop' | 'hash';

export interface MaskedFieldMarker {
  _masked: true;
  _present: boolean;
}

// ── Payload Descriptor ──────────────────────────────────

export interface PayloadDescriptor {
  payload_format: PayloadFormat;
  payload_encoding: PayloadEncoding;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
  payload: unknown;
}
