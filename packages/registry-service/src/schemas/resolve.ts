import { z } from "zod";

export const resolveActiveQuerySchema = z.object({
  prefix: z.string().optional(),
});
