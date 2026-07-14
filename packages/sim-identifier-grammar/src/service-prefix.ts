// @def.boundary sim-identifier-grammar
import { z } from 'zod';

export const SERVICE_PREFIX_NAMESPACES = ['sim'] as const;
export const SERVICE_PREFIX_CATEGORIES = ['svc', 'slice', 'evt', 'cache'] as const;
const NAME_REGEX = /^[a-z][a-z0-9-]{0,30}$/;

export type ServicePrefixNamespace = (typeof SERVICE_PREFIX_NAMESPACES)[number];
export type ServicePrefixCategory = (typeof SERVICE_PREFIX_CATEGORIES)[number];

export interface ServicePrefix {
  namespace: ServicePrefixNamespace;
  category: ServicePrefixCategory;
  name: string;
}

const ServicePrefixInputSchema = z.object({
  namespace: z.enum(SERVICE_PREFIX_NAMESPACES),
  category: z.enum(SERVICE_PREFIX_CATEGORIES),
  name: z.string().regex(NAME_REGEX),
});

export const ServicePrefixSchema = z
  .string()
  .regex(/^sim\.(svc|slice|evt|cache)\.[a-z][a-z0-9-]{0,30}$/, {
    message: 'invalid service prefix',
  });

export function buildServicePrefix(input: ServicePrefix): string {
  const v = ServicePrefixInputSchema.parse(input);
  return `${v.namespace}.${v.category}.${v.name}`;
}

export function parseServicePrefix(s: string): ServicePrefix {
  ServicePrefixSchema.parse(s);
  const [namespace, category, name] = s.split('.') as [
    ServicePrefixNamespace,
    ServicePrefixCategory,
    string,
  ];
  return { namespace, category, name };
}
