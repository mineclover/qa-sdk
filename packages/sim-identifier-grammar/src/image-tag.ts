import { z } from "zod";
import {
  buildServicePrefix,
  parseServicePrefix,
  type ServicePrefix,
} from "./service-prefix.js";
import {
  buildVersionTag,
  parseVersionTag,
  type VersionTag,
} from "./version-tag.js";

export const IMAGE_REGISTRIES = ["qa-sdk"] as const;
export type ImageRegistry = (typeof IMAGE_REGISTRIES)[number];

export interface ImageTag {
  registry: ImageRegistry;
  servicePrefix: ServicePrefix;
  versionTag: VersionTag;
}

const ImageTagInputSchema = z.object({
  registry: z.enum(IMAGE_REGISTRIES),
  servicePrefix: z.object({
    namespace: z.literal("sim"),
    category: z.literal("svc"),
    name: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
  }),
  versionTag: z.object({
    axis: z.literal("version"),
    value: z.number().int().positive(),
    state: z.enum(["stable", "candidate", "retired"]),
  }),
});

function prefixToImageName(p: ServicePrefix): string {
  // sim.svc.approval → sim-approval-api
  return `${p.namespace}-${p.name}-api`;
}

function imageNameToPrefix(image: string): ServicePrefix {
  // sim-approval-api → { sim, svc, approval }
  const m = image.match(/^sim-([a-z][a-z0-9-]{0,30})-api$/);
  if (!m) throw new Error(`invalid image name: ${image}`);
  return { namespace: "sim", category: "svc", name: m[1] };
}

export function buildImageTag(input: ImageTag): string {
  const v = ImageTagInputSchema.parse(input);
  const prefixStr = buildServicePrefix(v.servicePrefix); // 검증
  void prefixStr;
  const versionStr = buildVersionTag(v.versionTag);
  return `${v.registry}/${prefixToImageName(v.servicePrefix)}:${versionStr}`;
}

export function parseImageTag(s: string): ImageTag {
  const m = s.match(/^([a-z][a-z0-9-]+)\/([a-z0-9-]+):(.+)$/);
  if (!m) throw new Error(`invalid image tag: ${s}`);
  const [, registry, image, version] = m;
  if (!IMAGE_REGISTRIES.includes(registry as ImageRegistry)) {
    throw new Error(`unknown registry: ${registry}`);
  }
  const servicePrefix = imageNameToPrefix(image);
  const versionTag = parseVersionTag(version);
  return {
    registry: registry as ImageRegistry,
    servicePrefix,
    versionTag,
  };
}

export { parseServicePrefix }; // for downstream test convenience
