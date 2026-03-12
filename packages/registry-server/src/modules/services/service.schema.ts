import { z } from "zod";

export const createServiceSchema = z.object({
  service_name: z.string().regex(/^[a-z][a-z0-9_]*$/, {
    message: "must be lowercase snake_case starting with a letter",
  }),
  display_name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const updateServiceSchema = z
  .object({
    display_name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["active", "deprecated", "retired"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field is required",
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
