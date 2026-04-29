import { z } from "zod";

export const PUBSUB_TOPICS = [
  "bitmap.invalidate",
  "routing.update",
  "controller.heartbeat",
] as const;
export type PubsubTopic = (typeof PUBSUB_TOPICS)[number];

export interface PubSubChannel {
  namespace: "sim";
  topic: PubsubTopic;
}

export const PubSubChannelSchema = z.object({
  namespace: z.literal("sim"),
  topic: z.enum(PUBSUB_TOPICS),
});

const CHANNEL_PATTERN =
  /^sim:(bitmap\.invalidate|routing\.update|controller\.heartbeat)$/;
export const PubSubChannelNameSchema = z.string().regex(CHANNEL_PATTERN);

export function buildPubsubChannel(input: PubSubChannel): string {
  const v = PubSubChannelSchema.parse(input);
  const out = `${v.namespace}:${v.topic}`;
  return PubSubChannelNameSchema.parse(out);
}

export function parsePubsubChannel(s: string): PubSubChannel {
  const m = CHANNEL_PATTERN.exec(s);
  if (!m) throw new Error(`invalid pubsub channel: ${s}`);
  return { namespace: "sim", topic: m[1] as PubsubTopic };
}
