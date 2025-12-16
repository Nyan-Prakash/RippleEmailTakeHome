// Type definitions and interfaces used across the application
// Re-export types from schemas for convenience

export type { BrandContext, Brand, Product } from "@/lib/schemas/brand";
export type { EmailSpec } from "@/lib/schemas/emailSpec";
export type { CampaignIntent } from "@/lib/schemas/campaign";
export type { Block } from "@/lib/schemas/blocks";

export type Placeholder = Record<string, never>;
