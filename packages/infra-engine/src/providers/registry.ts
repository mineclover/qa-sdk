// providers/registry.ts — 프로바이더 레지스트리
import type { DeployProvider } from "../adapters/adapter.js";

const providers = new Map<string, DeployProvider>();

export function registerProvider(provider: DeployProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): DeployProvider {
  const p = providers.get(name);
  if (!p) throw new Error(`알 수 없는 프로바이더: ${name}. 등록된 프로바이더: ${[...providers.keys()].join(", ")}`);
  return p;
}

export function listProviders(): string[] {
  return [...providers.keys()];
}
