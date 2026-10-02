// @def.boundary platform-demo-system
// @def.doc platform-demo-system

/** Bundled event read model for the static platform demo. */
import {
  DEMO_ENVS,
  DEMO_EVT_SVC_VALUES,
  DEMO_INITIATORS,
  DEMO_KO,
  DEMO_SVCS,
  demoDecodeSvc,
  demoEventsFor,
  type DemoVer,
} from 'demo-snapshot';
import type { EvtCellsResponse } from './registry.js';
import { eventStride, EVENT_INITIATOR_CAP } from './event-address.js';

export async function fetchMockEvtCells(
  initiator: string,
  ver: DemoVer = 'v2',
): Promise<EvtCellsResponse> {
  const initiatorPos = DEMO_INITIATORS.indexOf(initiator as (typeof DEMO_INITIATORS)[number]) + 1;
  if (initiatorPos <= 0) throw new Error(`Invalid initiator: ${initiator}`);
  const events = demoEventsFor(ver);
  const svcStride = eventStride(ver);
  const svcLabels = DEMO_EVT_SVC_VALUES.map((svcValue, index) => {
    const [envPos, _regionPos, svcPos] = demoDecodeSvc(svcValue);
    const env = DEMO_ENVS[envPos - 1];
    const svcName = DEMO_SVCS[svcPos - 1];
    return {
      pos: index + 1,
      svcValue,
      svcName: DEMO_KO.svc[svcName] ?? svcName,
      env,
    };
  });
  const eventLabels = events.map((id, index) => ({
    pos: index + 1,
    id,
    ko: DEMO_KO.event[id] ?? id,
  }));
  const cells = DEMO_EVT_SVC_VALUES.flatMap((_svcValue, svcIndex) =>
    events.map((_event, eventIndex) => ({
      svcPos: svcIndex + 1,
      evtPos: eventIndex + 1,
      value: svcIndex * svcStride + eventIndex * EVENT_INITIATOR_CAP + (initiatorPos - 1),
    })),
  );
  return {
    ver,
    svcStride,
    prefix: `event:${ver}`,
    maxValue: DEMO_EVT_SVC_VALUES.length * svcStride - 1,
    initiator,
    svcLabels,
    eventLabels,
    cells,
  };
}
