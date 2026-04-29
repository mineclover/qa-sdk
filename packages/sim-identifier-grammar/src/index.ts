// sim-identifier-grammar — 시뮬 식별자 합성/역분해/검증 grammar 진입점.
// 자세한 정의는 spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md

export {
  buildServicePrefix,
  parseServicePrefix,
  ServicePrefixSchema,
  SERVICE_PREFIX_NAMESPACES,
  SERVICE_PREFIX_CATEGORIES,
  type ServicePrefix,
  type ServicePrefixNamespace,
  type ServicePrefixCategory,
} from "./service-prefix.js";

export {
  buildVersionTag,
  parseVersionTag,
  VersionTagSchema,
  VERSION_TAG_STATES,
  type VersionTag,
  type VersionTagState,
} from "./version-tag.js";

export {
  buildImageTag,
  parseImageTag,
  IMAGE_REGISTRIES,
  type ImageTag,
  type ImageRegistry,
} from "./image-tag.js";
