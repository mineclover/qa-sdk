// @def.boundary registry-system
// @def.doc registry-system

import { z } from 'zod';

export const simulateSchema = z.object({
  changes: z.record(
    z.string(),
    z.object({
      capacity: z.number().int().positive(),
    }),
  ),
});

export type SimulateInput = z.infer<typeof simulateSchema>;
