// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// providers/all.ts — 전체 프로바이더 일괄 등록
import { registerProvider } from "./registry.js";
import { createLocalProvider, type LocalProviderOptions } from "./local.js";
import { createCloudflareProvider } from "./cloudflare.js";
import { createRailwayProvider } from "./railway.js";
import { createAwsProvider } from "./aws.js";
import { createGcpProvider } from "./gcp.js";
import { createVultrProvider } from "./vultr.js";

export function registerAllProviders(localOptions?: LocalProviderOptions): void {
  registerProvider(createLocalProvider(localOptions));
  registerProvider(createCloudflareProvider());
  registerProvider(createRailwayProvider());
  registerProvider(createAwsProvider());
  registerProvider(createGcpProvider());
  registerProvider(createVultrProvider());
}
