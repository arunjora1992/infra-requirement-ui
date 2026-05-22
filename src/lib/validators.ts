import { z } from "zod";

export const RequirementCreateSchema = z.object({
  title: z.string().min(3).max(180),
  description: z.string().max(4000).optional(),
  team: z.string().min(1).max(120),
  environment: z.enum(["DEV", "STAGING", "PROD", "DR"]).default("DEV"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  vmCount: z.coerce.number().int().min(0).default(0),
  vmCpu: z.coerce.number().int().min(0).optional(),
  vmMemoryGB: z.coerce.number().int().min(0).optional(),
  vmStorageGB: z.coerce.number().int().min(0).optional(),
  osImage: z.string().max(120).optional(),
  podCount: z.coerce.number().int().min(0).default(0),
  podCpu: z.string().max(40).optional(),
  podMemory: z.string().max(40).optional(),
  k8sCluster: z.string().max(120).optional(),
  k8sNamespace: z.string().max(120).optional(),
  needsLoadBalancer: z.coerce.boolean().default(false),
  needsPublicIp: z.coerce.boolean().default(false),
  needsDatabase: z.coerce.boolean().default(false),
  databaseEngine: z.string().max(60).optional(),
  storageGB: z.coerce.number().int().min(0).optional(),
  tenureDays: z.coerce.number().int().min(1).max(3650),
  startDate: z.coerce.date().optional(),
  costCenter: z.string().max(80).optional(),
  justification: z.string().max(4000).optional(),
  managerEmail: z.string().email(),
  managerName: z.string().min(1).max(120),
});

export type RequirementCreateInput = z.infer<typeof RequirementCreateSchema>;

export const RequirementUpdateSchema = RequirementCreateSchema.partial().extend({
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "IN_REVIEW",
      "APPROVED",
      "REJECTED",
      "PROVISIONED",
      "EXPIRED",
      "SHUTDOWN",
    ])
    .optional(),
});

export type RequirementUpdateInput = z.infer<typeof RequirementUpdateSchema>;
