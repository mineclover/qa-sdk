import { z } from "zod";

export const createEventSchema = z.object({
  event_key: z.string().regex(/^[a-z][a-z0-9_]*$/, {
    message: "must be lowercase snake_case starting with a letter",
  }),
  display_name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  record_kind: z.enum(["log", "span", "both"]).default("log"),
  bump: z.enum(["major", "minor", "patch"]).default("major"),
});

export const updateEventSchema = z
  .object({
    display_name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["active", "deprecated", "retired"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field is required",
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
