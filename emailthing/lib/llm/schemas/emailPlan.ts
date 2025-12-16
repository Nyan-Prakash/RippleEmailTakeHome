import { z } from "zod";

/**
 * Email subject with primary and alternatives
 */
const SubjectSchema = z.object({
  primary: z.string().max(70, "Subject line must be 70 characters or less"),
  alternatives: z
    .array(
      z.string().max(70, "Alternative subject must be 70 characters or less")
    )
    .max(3, "Maximum 3 alternative subjects"),
});

/**
 * Email layout configuration
 */
const LayoutSchema = z.object({
  template: z.enum([
    "hero",
    "hero_with_products",
    "product_grid",
    "editorial",
    "announcement",
    "newsletter",
    "minimal",
  ]),
  density: z.enum(["light", "medium", "high"]),
});

/**
 * Call-to-action within a section
 */
const SectionCTASchema = z.object({
  label: z.string().max(32, "CTA label must be 32 characters or less"),
  hrefHint: z
    .string()
    .max(120, "CTA href hint must be 120 characters or less")
    .optional(),
});

/**
 * Email section
 * v2: Updated with new section types for better planning
 */
const SectionSchema = z.object({
  id: z.string().max(24, "Section ID must be 24 characters or less"),
  type: z.enum([
    // Header types
    "header",
    "nav_header",
    "announcement_bar",
    // Main content types
    "hero",
    "value_props",
    "feature_grid",
    "benefits_list",
    "story_section",
    "product_feature",
    "product_grid",
    "product_spotlight",
    "comparison",
    // Social proof / trust
    "social_proof",
    "social_proof_grid",
    "testimonial",
    "testimonial_card",
    "trust_bar",
    "metric_strip",
    // CTAs and banners
    "promo_banner",
    "cta_section",
    "cta_banner",
    "secondary_cta",
    // Support / info
    "faq",
    "faq_mini",
    "legal_fine_print",
    // Visual elements
    "section_title",
    "divider_band",
    // Footer
    "footer",
  ]),
  purpose: z
    .string()
    .max(120, "Section purpose must be 120 characters or less"),
  headline: z
    .string()
    .max(60, "Section headline must be 60 characters or less")
    .optional(),
  bodyGuidance: z
    .string()
    .max(260, "Body guidance must be 260 characters or less")
    .optional(),
  cta: SectionCTASchema.optional(),
  productIds: z
    .array(z.string())
    .max(8, "Maximum 8 products per section")
    .optional(),
  styleHints: z
    .array(z.string().max(40, "Style hint must be 40 characters or less"))
    .max(6, "Maximum 6 style hints per section")
    .optional(),
});

/**
 * Selected product for the email
 */
const SelectedProductSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
  title: z.string().max(90, "Product title must be 90 characters or less"),
  price: z
    .string()
    .max(20, "Product price must be 20 characters or less")
    .optional(),
  imageUrl: z.string().url().optional(),
  url: z.string().url().optional(),
  whyThisProduct: z
    .string()
    .max(120, "Product rationale must be 120 characters or less"),
});

/**
 * Personalization configuration
 */
const PersonalizationSchema = z.object({
  level: z.enum(["none", "light", "medium"]),
  ideas: z
    .array(
      z.string().max(80, "Personalization idea must be 80 characters or less")
    )
    .max(4, "Maximum 4 personalization ideas"),
});

/**
 * Compliance requirements
 */
const ComplianceSchema = z.object({
  includeUnsubscribe: z.literal(true),
  includePhysicalAddressHint: z.literal(true),
  claimsToAvoid: z
    .array(z.string().max(80, "Claim to avoid must be 80 characters or less"))
    .max(6, "Maximum 6 claims to avoid")
    .optional(),
});

/**
 * Email Plan schema - structured email outline/strategy
 */
export const EmailPlanSchema = z
  .object({
    subject: SubjectSchema,
    preheader: z.string().max(110, "Preheader must be 110 characters or less"),
    layout: LayoutSchema,
    sections: z
      .array(SectionSchema)
      .min(3, "Must have at least 3 sections")
      .max(10, "Maximum 10 sections"),
    selectedProducts: z
      .array(SelectedProductSchema)
      .max(8, "Maximum 8 selected products"),
    personalization: PersonalizationSchema,
    compliance: ComplianceSchema,
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(220, "Rationale must be 220 characters or less"),
  })
  .superRefine((data, ctx) => {
    // Check for required header and footer sections
    // v2: Allow multiple header types
    const sectionTypes = data.sections.map((s) => s.type);
    const validHeaderTypes = ["header", "nav_header", "announcement_bar"];
    const hasHeader = sectionTypes.some(type => validHeaderTypes.includes(type));
    const hasFooter = sectionTypes.includes("footer");

    if (!hasHeader) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one header section (header, nav_header, or announcement_bar)",
        path: ["sections"],
      });
    }

    if (!hasFooter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must include at least one 'footer' section",
        path: ["sections"],
      });
    }

    // Validate productIds reference selectedProducts
    const selectedProductIds = new Set(data.selectedProducts.map((p) => p.id));
    data.sections.forEach((section, idx) => {
      if (section.productIds && section.productIds.length > 0) {
        section.productIds.forEach((productId) => {
          if (!selectedProductIds.has(productId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Product ID "${productId}" in section does not exist in selectedProducts`,
              path: ["sections", idx, "productIds"],
            });
          }
        });
      }
    });

    // If no selected products, validate template and sections
    if (data.selectedProducts.length === 0) {
      const productTemplates = ["product_grid", "hero_with_products"];
      // v2: Updated product section types
      const productSectionTypes = ["product_grid", "product_feature", "product_spotlight"];

      // Check if any section has productIds
      const hasProductIds = data.sections.some(
        (s) => s.productIds && s.productIds.length > 0
      );

      if (hasProductIds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Sections cannot have productIds when selectedProducts is empty",
          path: ["sections"],
        });
      }

      // Check if template requires products
      const hasProductSections = data.sections.some((s) =>
        productSectionTypes.includes(s.type)
      );

      if (
        productTemplates.includes(data.layout.template) &&
        hasProductSections
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Template "${data.layout.template}" requires products, but selectedProducts is empty`,
          path: ["layout", "template"],
        });
      }
    }
  });

/**
 * TypeScript type inferred from the schema
 */
export type EmailPlan = z.infer<typeof EmailPlanSchema>;
