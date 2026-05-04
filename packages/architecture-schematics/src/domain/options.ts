// @def.boundary scaffold-domain-schematic
export interface DomainOptions {
  /** Domain name, e.g. "payment" or "assignment". */
  name: string;
  /** Generate query-side read model contracts and projection skeletons. */
  includeReadModel?: boolean;
  /** Generate UI-facing BFF query adapter and controller. Implies read model generation. */
  includeBff?: boolean;
  /** Parent NestJS module file that should import the generated domain module. */
  parentModule: string;
  /** Skip prettier/eslint format task scheduling. Useful for tests. */
  skipFormat?: boolean;
}
