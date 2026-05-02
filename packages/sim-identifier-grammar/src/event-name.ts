import { z } from "zod";
import {
  EVENT_DOMAINS,
  EVENT_AGGREGATES_BY_DOMAIN,
  EVENT_VERBS_PAST,
  type EventDomain,
  type EventVerbPast,
} from "../../../simulations/enterprise-pm/contracts/event-vocabulary.catalog.js";

export interface EventName {
  domain: EventDomain;
  aggregate: string;
  verbPast: EventVerbPast;
}

const EventNameInputSchema = z
  .object({
    domain: z.enum(EVENT_DOMAINS),
    aggregate: z.string().regex(/^[a-z][a-z0-9-]*$/),
    verbPast: z.enum(EVENT_VERBS_PAST),
  })
  .superRefine((v, ctx) => {
    const allowed = EVENT_AGGREGATES_BY_DOMAIN[v.domain];
    if (!allowed.includes(v.aggregate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregate"],
        message: `aggregate "${v.aggregate}" not registered for domain "${v.domain}" (allowed: ${allowed.join(", ")})`,
      });
    }
  });

export function buildEventName(input: EventName): string {
  const v = EventNameInputSchema.parse(input);
  return `${v.domain}.${v.aggregate}.${v.verbPast}`;
}

export function parseEventName(s: string): EventName {
  const parts = s.split(".");
  if (parts.length !== 3) throw new Error(`invalid event name (must be 3-tier): ${s}`);
  const [domain, aggregate, verbPast] = parts;
  return EventNameInputSchema.parse({ domain, aggregate, verbPast }) as EventName;
}
