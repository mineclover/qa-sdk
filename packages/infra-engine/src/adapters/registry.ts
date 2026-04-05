import type { RegistryAdapter, DeploymentSyncParams, DeploymentSyncResult } from "./adapter.js";

export function createRegistryAdapter(baseUrl: string): RegistryAdapter {
  return {
    async syncDeployment(params: DeploymentSyncParams): Promise<DeploymentSyncResult> {
      const url = `${baseUrl}/api/services/${params.serviceId}/deployments/sync?catalog=${params.catalogId ?? "demo"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deploymentVersion: params.deploymentVersion,
          runtime: params.runtime,
          provider: params.provider,
          project: params.project,
          stack: params.stack,
          resourceKey: params.resourceKey,
          url: params.url,
          urn: params.urn,
          outputs: params.outputs,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`registry sync 실패 (${res.status}): ${text}`);
      }

      const data = (await res.json()) as { manifestImpact?: string };
      return { synced: true, manifestImpact: data.manifestImpact };
    },
  };
}
