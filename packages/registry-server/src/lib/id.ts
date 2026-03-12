import { ulid } from "ulid";

export function newServiceId(): string {
  return `svc_${ulid()}`;
}

export function newEventId(): string {
  return `evt_${ulid()}`;
}
