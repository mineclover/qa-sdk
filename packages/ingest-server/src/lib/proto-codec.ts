// @def.boundary ingest-system
// @def.doc ingest-system

/** Proto envelope 디시리얼라이즈 — logger의 ProtobufTransport와 페어 */

const MAGIC = new Uint8Array([0x51, 0x41, 0x50, 0x42]); // "QAPB"

export function fromProtoEnvelope(bytes: Uint8Array): unknown {
  if (bytes.length < 8) throw new Error('Proto envelope too short');
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('Invalid proto magic');
  }
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, false);
  if (bytes.length < 8 + len) throw new Error('Proto envelope truncated');
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(bytes.subarray(8, 8 + len)));
}
