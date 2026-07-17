import { join, resolve } from 'node:path';

export interface ApiImpactSourceProfile {
  id: string;
  endpointRoot: string;
  implementationRoot: string;
  consumerRoot: string;
}

/**
 * Resolve the source roots used by the advisory analyzer.
 * External workspace roots are configurable so local absolute paths do not
 * become part of the analyzer contract.
 */
export function resolveSourceProfiles(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): readonly ApiImpactSourceProfile[] {
  const simulationRoot = resolve(
    root,
    env.QA_API_IMPACT_SIM_ROOT?.trim() || 'simulations/enterprise-pm',
  );
  const oaSdkRoot = resolve(root, env.QA_API_IMPACT_OA_SDK_ROOT?.trim() || '../oa-sdk');
  const implementationRoot = join(simulationRoot, 'services');
  const consumerRoot = join(simulationRoot, 'scenarios/src');

  return [
    {
      id: 'oa-sdk',
      endpointRoot: join(oaSdkRoot, 'packages/schemas/src/domains'),
      implementationRoot,
      consumerRoot,
    },
    {
      id: 'enterprise-pm',
      endpointRoot: join(simulationRoot, 'contracts/openapi/src/domains'),
      implementationRoot,
      consumerRoot,
    },
  ];
}
