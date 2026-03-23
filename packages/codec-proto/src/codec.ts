/**
 * JSON TransmissionEnvelope ↔ Protobuf 바이너리 변환.
 *
 * 외부 protobuf 라이브러리 없이 순수 구현 (zero-dependency).
 * proto3 wire format: varint + length-delimited.
 * proto/transmission.proto 스키마와 1:1 대응.
 */
import type { TransmissionEnvelope, EventRecord } from "@qa-sdk/core";

// ═══ Wire format writers ═══

function writeVarint(buf: number[], value: number) {
  value = value >>> 0;
  while (value > 0x7f) { buf.push((value & 0x7f) | 0x80); value >>>= 7; }
  buf.push(value & 0x7f);
}

function writeTag(buf: number[], fn: number, wt: number) { writeVarint(buf, (fn << 3) | wt); }

function writeString(buf: number[], fn: number, v: string) {
  if (!v) return;
  writeTag(buf, fn, 2);
  const b = new TextEncoder().encode(v);
  writeVarint(buf, b.length);
  for (const x of b) buf.push(x);
}

function writeBytes(buf: number[], fn: number, v: Uint8Array) {
  if (!v.length) return;
  writeTag(buf, fn, 2);
  writeVarint(buf, v.length);
  for (const x of v) buf.push(x);
}

function writeBool(buf: number[], fn: number, v: boolean) {
  if (!v) return;
  writeTag(buf, fn, 0);
  buf.push(1);
}

function writeDouble(buf: number[], fn: number, v: number) {
  if (!v) return;
  writeTag(buf, fn, 1);
  const ab = new ArrayBuffer(8);
  new DataView(ab).setFloat64(0, v, true);
  for (const x of new Uint8Array(ab)) buf.push(x);
}

function writeMsg(buf: number[], fn: number, msg: number[]) {
  writeTag(buf, fn, 2);
  writeVarint(buf, msg.length);
  for (const x of msg) buf.push(x);
}

function writeMap(buf: number[], fn: number, map: Record<string, string>) {
  for (const [k, v] of Object.entries(map)) {
    const e: number[] = [];
    writeString(e, 1, k);
    writeString(e, 2, v);
    writeMsg(buf, fn, e);
  }
}

// ═══ Encode ═══

function encodeRecord(r: EventRecord): number[] {
  const b: number[] = [];
  writeString(b, 1, r.log_id);
  writeString(b, 2, r.timestamp);
  writeString(b, 3, r.record_kind);
  writeString(b, 4, r.trace_id);
  writeString(b, 5, r.span_id);
  if (r.parent_span_id) writeString(b, 6, r.parent_span_id);
  writeString(b, 7, r.event_key);
  writeString(b, 8, r.event_version);
  if (r.span_name) writeString(b, 10, r.span_name);
  if (r.start_time) writeString(b, 11, r.start_time);
  if (r.end_time) writeString(b, 12, r.end_time);
  if (r.status_code) writeString(b, 13, r.status_code);
  writeString(b, 20, r.payload_format);
  writeString(b, 21, r.payload_encoding);
  writeBool(b, 22, r.payload_masking_applied);
  for (const f of r.payload_masked_fields) writeString(b, 23, f);
  if (r.payload) writeBytes(b, 24, new TextEncoder().encode(JSON.stringify(r.payload)));
  if (r.qa_session_id) writeString(b, 30, r.qa_session_id);
  if (r.address_context) writeMap(b, 40, r.address_context);
  if (r.metric_name) writeString(b, 51, r.metric_name);
  if (r.metric_value) writeDouble(b, 52, r.metric_value);
  if (r.actor_id) writeString(b, 60, r.actor_id);
  if (r.user_id) writeString(b, 61, r.user_id);
  if (r.user_attributes) writeMap(b, 62, r.user_attributes);
  return b;
}

export function encodeEnvelope(env: TransmissionEnvelope): Uint8Array {
  const b: number[] = [];
  writeString(b, 1, env.transmission_id);
  writeString(b, 2, env.sent_at);
  const ow: number[] = []; writeString(ow, 1, env.owner.owner_type); writeString(ow, 2, env.owner.owner_id);
  writeMsg(b, 3, ow);
  const sr: number[] = []; writeString(sr, 1, env.source.service_name); writeString(sr, 2, env.source.sdk_name); writeString(sr, 3, env.source.sdk_version);
  writeMsg(b, 4, sr);
  const rt: number[] = []; writeString(rt, 1, env.runtime.platform);
  writeMsg(b, 5, rt);
  const bd: number[] = []; writeString(bd, 1, env.build.env);
  writeMsg(b, 6, bd);
  if (env.infra_context) writeMap(b, 7, env.infra_context);
  for (const r of env.records) writeMsg(b, 10, encodeRecord(r));
  return new Uint8Array(b);
}

// ═══ Decode ═══

class R { private p = 0; constructor(private b: Uint8Array) {}
  get done() { return this.p >= this.b.length; }
  varint(): number { let r = 0, s = 0; while (this.p < this.b.length) { const b = this.b[this.p++]; r |= (b & 0x7f) << s; if (!(b & 0x80)) return r >>> 0; s += 7; } return r; }
  tag() { const v = this.varint(); return { f: v >>> 3, w: v & 7 }; }
  bytes() { const l = this.varint(); const s = this.b.slice(this.p, this.p + l); this.p += l; return s; }
  str() { return new TextDecoder().decode(this.bytes()); }
  bool() { return this.varint() !== 0; }
  f64() { const s = this.b.slice(this.p, this.p + 8); this.p += 8; return new DataView(s.buffer, s.byteOffset).getFloat64(0, true); }
  skip(w: number) { if (w === 0) this.varint(); else if (w === 1) this.p += 8; else if (w === 2) this.p += this.varint(); else if (w === 5) this.p += 4; }
  sub() { return new R(this.bytes()); }
}

function decodeMapEntry(r: R): [string, string] { let k = "", v = ""; while (!r.done) { const { f, w } = r.tag(); if (f===1) k = r.str(); else if (f===2) v = r.str(); else r.skip(w); } return [k, v]; }

function decodeRec(r: R): EventRecord {
  const o: any = { payload_masking_applied: false, payload_masked_fields: [] };
  const ac: Record<string,string> = {}, ua: Record<string,string> = {};
  while (!r.done) { const {f,w} = r.tag();
    if (f===1&&w===2) o.log_id=r.str(); else if (f===2&&w===2) o.timestamp=r.str();
    else if (f===3&&w===2) o.record_kind=r.str(); else if (f===4&&w===2) o.trace_id=r.str();
    else if (f===5&&w===2) o.span_id=r.str(); else if (f===6&&w===2) o.parent_span_id=r.str();
    else if (f===7&&w===2) o.event_key=r.str(); else if (f===8&&w===2) o.event_version=r.str();
    else if (f===20&&w===2) o.payload_format=r.str(); else if (f===21&&w===2) o.payload_encoding=r.str();
    else if (f===22&&w===0) o.payload_masking_applied=r.bool();
    else if (f===23&&w===2) o.payload_masked_fields.push(r.str());
    else if (f===24&&w===2) o.payload=JSON.parse(new TextDecoder().decode(r.bytes()));
    else if (f===30&&w===2) o.qa_session_id=r.str();
    else if (f===40&&w===2) { const [k,v]=decodeMapEntry(r.sub()); ac[k]=v; }
    else if (f===60&&w===2) o.actor_id=r.str();
    else r.skip(w);
  }
  if (Object.keys(ac).length) o.address_context=ac;
  if (Object.keys(ua).length) o.user_attributes=ua;
  return o;
}

export function decodeEnvelope(buf: Uint8Array): TransmissionEnvelope {
  const r = new R(buf), e: any = { records: [] };
  while (!r.done) { const {f,w} = r.tag();
    if (f===1&&w===2) e.transmission_id=r.str(); else if (f===2&&w===2) e.sent_at=r.str();
    else if (f===3&&w===2) { const s=r.sub(); e.owner={owner_type:"",owner_id:""}; while(!s.done){const{f:sf,w:sw}=s.tag(); if(sf===1)e.owner.owner_type=s.str();else if(sf===2)e.owner.owner_id=s.str();else s.skip(sw);} }
    else if (f===4&&w===2) { const s=r.sub(); e.source={service_name:"",sdk_name:"",sdk_version:""}; while(!s.done){const{f:sf}=s.tag(); if(sf===1)e.source.service_name=s.str();else if(sf===2)e.source.sdk_name=s.str();else if(sf===3)e.source.sdk_version=s.str();else s.skip(2);} }
    else if (f===5&&w===2) { const s=r.sub(); e.runtime={platform:""}; while(!s.done){const{f:sf}=s.tag(); if(sf===1)e.runtime.platform=s.str();else s.skip(2);} }
    else if (f===6&&w===2) { const s=r.sub(); e.build={env:""}; while(!s.done){const{f:sf}=s.tag(); if(sf===1)e.build.env=s.str();else s.skip(2);} }
    else if (f===10&&w===2) e.records.push(decodeRec(r.sub()));
    else r.skip(w);
  }
  return e;
}
