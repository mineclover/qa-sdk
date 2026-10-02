// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/** Canonical event address helpers for the platform demo read models. */
import {
  DEMO_CATALOG,
  DEMO_EVENT_CAP,
  DEMO_INITIATORS,
  encodePrefixByValue,
  type DemoVer,
} from 'demo-snapshot';

export const EVENT_INITIATOR_CAP =
  DEMO_CATALOG.axes.initiator.versions.v1.capacity ?? DEMO_INITIATORS.length;

export function eventStride(ver: DemoVer): number {
  return DEMO_EVENT_CAP[ver] * EVENT_INITIATOR_CAP;
}

export function eventAddress(
  svcPos: number,
  eventPos: number,
  initiatorPos: number,
  ver: DemoVer,
): number {
  return (
    (svcPos - 1) * eventStride(ver) + (eventPos - 1) * EVENT_INITIATOR_CAP + (initiatorPos - 1)
  );
}

export function encodeEventAddress(
  svcValue: number,
  eventName: string,
  initiator: string,
  ver: DemoVer,
): number {
  return encodePrefixByValue(DEMO_CATALOG, 'event', ver, {
    evt_svc: svcValue,
    event_name: eventName,
    initiator,
  });
}
