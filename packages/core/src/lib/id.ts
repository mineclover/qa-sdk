import { ulid } from "ulid";

export function newTransmissionId(): string {
  return `txm_${ulid()}`;
}

export function newLogId(): string {
  return `log_${ulid()}`;
}

export function newTraceId(): string {
  return `trc_${ulid()}`;
}

export function newSpanId(): string {
  return `spn_${ulid()}`;
}

export function newQaSessionId(): string {
  return `qas_${ulid()}`;
}
