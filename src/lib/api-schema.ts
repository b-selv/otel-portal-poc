import { z } from "zod";

export const createApiSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).default(""),
  basePath: z.string().trim().regex(/^\/[a-zA-Z0-9/_-]*$/).max(200),
  backendUrl: z.string().url().max(1000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET")
});

export type CreateApiInput = z.infer<typeof createApiSchema>;
