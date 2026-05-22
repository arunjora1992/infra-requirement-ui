import { z } from "zod";

export const VmSpecSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  purpose: z.string().max(160).optional(),
  cpu: z.coerce.number().int().min(1).max(256),
  memoryGB: z.coerce.number().int().min(1).max(4096),
  storageGB: z.coerce.number().int().min(1).max(65536),
  osImage: z.string().max(120).optional(),
});
export type VmSpecInput = z.infer<typeof VmSpecSchema>;

export const VmSpecProvisioningSchema = z.object({
  id: z.string(),
  hostname: z.string().max(255).optional().nullable(),
  ipAddress: z
    .string()
    .max(64)
    .regex(
      /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$|^$/,
      "Must be a valid IPv4/IPv6 address",
    )
    .optional()
    .nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const RequirementCreateSchema = z
  .object({
    title: z.string().min(3, "Title is required").max(180),
    description: z.string().max(4000).optional(),
    projectName: z.string().min(1, "Project name is required").max(120),
    environment: z.enum(["DEV", "STAGING", "PROD", "DR"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    vmSpecs: z.array(VmSpecSchema).default([]),
    needsK8s: z.coerce.boolean().default(false),
    k8sNamespace: z.string().max(120).optional(),
    nsQuotaCpu: z.coerce.number().int().min(1).max(2048).optional(),
    nsQuotaMemoryGB: z.coerce.number().int().min(1).max(8192).optional(),
    nsQuotaStorageGB: z.coerce.number().int().min(1).max(131072).optional(),
    utilityServices: z.array(z.string().min(1).max(60)).default([]),
    needsLoadBalancer: z.coerce.boolean().default(false),
    needsPublicIp: z.coerce.boolean().default(false),
    needsDatabase: z.coerce.boolean().default(false),
    databaseEngine: z.string().max(60).optional(),
    storageGB: z.coerce.number().int().min(0).optional(),
    tenureDays: z.coerce.number().int().min(1, "Tenure is required").max(3650),
    startDate: z.coerce.date().optional(),
    costCenter: z.string().max(80).optional(),
    justification: z.string().min(10, "Justification is required").max(4000),
    managerEmail: z.string().email("Valid manager email is required"),
    managerName: z.string().min(1, "Manager name is required").max(120),
  })
  .refine((d) => d.vmSpecs.length > 0 || d.needsK8s, {
    message: "Add at least one VM, or enable Kubernetes",
    path: ["vmSpecs"],
  })
  .refine(
    (d) =>
      !d.needsK8s ||
      ((d.nsQuotaCpu ?? 0) > 0 && (d.nsQuotaMemoryGB ?? 0) > 0),
    {
      message:
        "K8s namespace quota must specify CPU and memory totals",
      path: ["nsQuotaCpu"],
    },
  );

export type RequirementCreateInput = z.infer<typeof RequirementCreateSchema>;

// PATCH from raiser/infra (status optional)
export const RequirementUpdateSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  description: z.string().max(4000).optional(),
  projectName: z.string().min(1).max(120).optional(),
  environment: z.enum(["DEV", "STAGING", "PROD", "DR"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  needsK8s: z.coerce.boolean().optional(),
  k8sNamespace: z.string().max(120).optional(),
  nsQuotaCpu: z.coerce.number().int().min(1).max(2048).optional(),
  nsQuotaMemoryGB: z.coerce.number().int().min(1).max(8192).optional(),
  nsQuotaStorageGB: z.coerce.number().int().min(1).max(131072).optional(),
  utilityServices: z.array(z.string()).optional(),
  needsLoadBalancer: z.coerce.boolean().optional(),
  needsPublicIp: z.coerce.boolean().optional(),
  needsDatabase: z.coerce.boolean().optional(),
  databaseEngine: z.string().max(60).optional(),
  storageGB: z.coerce.number().int().min(0).optional(),
  tenureDays: z.coerce.number().int().min(1).max(3650).optional(),
  startDate: z.coerce.date().optional(),
  costCenter: z.string().max(80).optional(),
  justification: z.string().max(4000).optional(),
  managerEmail: z.string().email().optional(),
  managerName: z.string().min(1).max(120).optional(),
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

// Infra-only provisioning update
export const ProvisioningUpdateSchema = z.object({
  provisionedNamespace: z.string().max(120).optional().nullable(),
  provisioningNotes: z.string().max(4000).optional().nullable(),
  vms: z.array(VmSpecProvisioningSchema).default([]),
});

export type ProvisioningUpdateInput = z.infer<typeof ProvisioningUpdateSchema>;
