import type { EmailSpec } from "../schemas/emailSpec";
import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "../schemas/campaign";
import type { EmailPlan } from "../schemas/plan";

/**
 * Validation severity
 */
export type ValidationSeverity = "error" | "warning";

/**
 * Validation issue with code for tracking
 */
export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: ValidationSeverity;
}

/**
 * Validation result
 */
export interface ValidationResult {
  ok: boolean; // true if no blocking errors
  issues: ValidationIssue[];
}

/**
 * Validate EmailSpec structural requirements and brand consistency
 *
 * Checks blocking errors (must fail generation):
 * 1. Section ordering (header first, footer last)
 * 2. Logo validity
 * 3. CTA sanity (button with valid text and href)
 * 4. Product alignment (productCard blocks valid and in correct sections)
 * 5. Duplicate section IDs
 * 6. Layout correctness
 *
 * Checks warnings (non-blocking):
 * 1. Theme drift from brand colors/fonts
 * 2. Campaign mismatch (sale without promo language, etc.)
 * 3. Content imbalance (too many sections, missing trust section)
 * 4. Copy length (near limits)
 */
export function validateEmailSpecStructure(args: {
  spec: EmailSpec;
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
}): ValidationResult {
  const { spec, brandContext, intent } = args;
  const issues: ValidationIssue[] = [];

  // === BLOCKING ERRORS ===

  // 1. Section ordering: header must be first, footer must be last
  if (spec.sections.length > 0) {
    const firstSection = spec.sections[0];
    const lastSection = spec.sections[spec.sections.length - 1];

    if (firstSection.type !== "header") {
      issues.push({
        code: "HEADER_NOT_FIRST",
        severity: "error",
        message: "Header section must be first",
        path: "sections[0]",
      });
    }

    if (lastSection.type !== "footer") {
      issues.push({
        code: "FOOTER_NOT_LAST",
        severity: "error",
        message: "Footer section must be last",
        path: `sections[${spec.sections.length - 1}]`,
      });
    }
  }

  // 2. Logo validity
  for (let sectionIdx = 0; sectionIdx < spec.sections.length; sectionIdx++) {
    const section = spec.sections[sectionIdx];

    // Check direct blocks
    for (let blockIdx = 0; blockIdx < section.blocks.length; blockIdx++) {
      const block = section.blocks[blockIdx];
      if (block.type === "logo") {
        if (!block.src || block.src.trim() === "") {
          issues.push({
            code: "LOGO_MISSING_SRC",
            severity: "error",
            message: "Logo block must have a non-empty src URL",
            path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
          });
        } else {
          try {
            new URL(block.src);
          } catch {
            issues.push({
              code: "LOGO_INVALID_URL",
              severity: "error",
              message: `Logo src must be a valid URL: ${block.src}`,
              path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
            });
          }
        }
      }
    }

    // Check in two-column layouts
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      for (let colIdx = 0; colIdx < section.layout.columns.length; colIdx++) {
        const column = section.layout.columns[colIdx];
        for (let blockIdx = 0; blockIdx < column.blocks.length; blockIdx++) {
          const block = column.blocks[blockIdx];
          if (block.type === "logo") {
            if (!block.src || block.src.trim() === "") {
              issues.push({
                code: "LOGO_MISSING_SRC",
                severity: "error",
                message: "Logo block must have a non-empty src URL",
                path: `sections[${sectionIdx}].layout.columns[${colIdx}].blocks[${blockIdx}]`,
              });
            } else {
              try {
                new URL(block.src);
              } catch {
                issues.push({
                  code: "LOGO_INVALID_URL",
                  severity: "error",
                  message: `Logo src must be a valid URL: ${block.src}`,
                  path: `sections[${sectionIdx}].layout.columns[${colIdx}].blocks[${blockIdx}]`,
                });
              }
            }
          }
        }
      }
    }
  }

  // 3. CTA sanity: at least one button with non-empty text and href
  let hasValidCta = false;
  const nonFooterSections = spec.sections.filter((s) => s.type !== "footer");

  for (const section of nonFooterSections) {
    for (const block of section.blocks) {
      if (
        block.type === "button" &&
        block.text &&
        block.text.trim() !== "" &&
        block.href &&
        block.href.trim() !== ""
      ) {
        hasValidCta = true;
        break;
      }
    }

    if (hasValidCta) break;

    // Check in two-column layouts
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      for (const column of section.layout.columns) {
        for (const block of column.blocks) {
          if (
            block.type === "button" &&
            block.text &&
            block.text.trim() !== "" &&
            block.href &&
            block.href.trim() !== ""
          ) {
            hasValidCta = true;
            break;
          }
        }
        if (hasValidCta) break;
      }
    }
  }

  if (!hasValidCta) {
    issues.push({
      code: "MISSING_VALID_CTA",
      severity: "error",
      message:
        "Email must include at least one button block with non-empty text and href outside the footer",
      path: "sections",
    });
  }

  // Check CTA text roughly matches intent (if ctaText provided)
  if (intent.ctaText && hasValidCta) {
    let foundMatchingCta = false;
    const expectedCtaLower = intent.ctaText.toLowerCase();

    for (const section of nonFooterSections) {
      for (const block of section.blocks) {
        if (block.type === "button" && block.text) {
          const actualCtaLower = block.text.toLowerCase();
          if (
            actualCtaLower.includes(expectedCtaLower) ||
            expectedCtaLower.includes(actualCtaLower) ||
            similarityScore(expectedCtaLower, actualCtaLower) > 0.5
          ) {
            foundMatchingCta = true;
            break;
          }
        }
      }

      if (foundMatchingCta) break;

      if (section.layout?.variant === "twoColumn" && section.layout.columns) {
        for (const column of section.layout.columns) {
          for (const block of column.blocks) {
            if (block.type === "button" && block.text) {
              const actualCtaLower = block.text.toLowerCase();
              if (
                actualCtaLower.includes(expectedCtaLower) ||
                expectedCtaLower.includes(actualCtaLower) ||
                similarityScore(expectedCtaLower, actualCtaLower) > 0.5
              ) {
                foundMatchingCta = true;
                break;
              }
            }
          }
          if (foundMatchingCta) break;
        }
      }
    }

    if (!foundMatchingCta) {
      issues.push({
        code: "CTA_MISMATCH",
        severity: "warning",
        message: `Button text should roughly match intent CTA: "${intent.ctaText}"`,
        path: "sections",
      });
    }
  }

  // 4. Product alignment
  if (spec.catalog && spec.catalog.items.length > 0) {
    const productIds = new Set(spec.catalog.items.map((p) => p.id));

    for (let sectionIdx = 0; sectionIdx < spec.sections.length; sectionIdx++) {
      const section = spec.sections[sectionIdx];

      // Check productCard blocks only appear in appropriate sections
      const validSectionsForProducts = ["productGrid", "hero"];

      for (let blockIdx = 0; blockIdx < section.blocks.length; blockIdx++) {
        const block = section.blocks[blockIdx];
        if (block.type === "productCard") {
          // Check product reference exists
          if (!productIds.has(block.productRef)) {
            issues.push({
              code: "INVALID_PRODUCT_REF",
              severity: "error",
              message: `Product reference "${block.productRef}" not found in catalog`,
              path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
            });
          }

          // Warn if productCard in unusual section
          if (!validSectionsForProducts.includes(section.type)) {
            issues.push({
              code: "PRODUCT_CARD_MISPLACED",
              severity: "warning",
              message: `productCard block in "${section.type}" section (expected in productGrid or hero)`,
              path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
            });
          }
        }
      }

      // Check in two-column layouts
      if (section.layout?.variant === "twoColumn" && section.layout.columns) {
        for (let colIdx = 0; colIdx < section.layout.columns.length; colIdx++) {
          const column = section.layout.columns[colIdx];
          for (let blockIdx = 0; blockIdx < column.blocks.length; blockIdx++) {
            const block = column.blocks[blockIdx];
            if (block.type === "productCard") {
              if (!productIds.has(block.productRef)) {
                issues.push({
                  code: "INVALID_PRODUCT_REF",
                  severity: "error",
                  message: `Product reference "${block.productRef}" not found in catalog`,
                  path: `sections[${sectionIdx}].layout.columns[${colIdx}].blocks[${blockIdx}]`,
                });
              }

              if (!validSectionsForProducts.includes(section.type)) {
                issues.push({
                  code: "PRODUCT_CARD_MISPLACED",
                  severity: "warning",
                  message: `productCard block in "${section.type}" section (expected in productGrid or hero)`,
                  path: `sections[${sectionIdx}].layout.columns[${colIdx}].blocks[${blockIdx}]`,
                });
              }
            }
          }
        }
      }
    }
  }

  // 5. Duplicate section IDs
  const sectionIds = spec.sections.map((s) => s.id);
  const duplicateIds = sectionIds.filter(
    (id, index) => sectionIds.indexOf(id) !== index
  );

  if (duplicateIds.length > 0) {
    issues.push({
      code: "DUPLICATE_SECTION_IDS",
      severity: "error",
      message: `Duplicate section IDs found: ${[...new Set(duplicateIds)].join(", ")}`,
      path: "sections",
    });
  }

  // 6. Layout correctness
  for (let sectionIdx = 0; sectionIdx < spec.sections.length; sectionIdx++) {
    const section = spec.sections[sectionIdx];

    if (section.layout?.variant === "twoColumn") {
      if (!section.layout.columns || section.layout.columns.length !== 2) {
        issues.push({
          code: "TWO_COLUMN_MISSING_COLUMNS",
          severity: "error",
          message: "twoColumn layout must define exactly 2 columns",
          path: `sections[${sectionIdx}].layout`,
        });
      } else {
        // Check widths are defined
        for (let colIdx = 0; colIdx < section.layout.columns.length; colIdx++) {
          const column = section.layout.columns[colIdx];
          if (!column.width || !column.width.match(/^\d+%$/)) {
            issues.push({
              code: "COLUMN_INVALID_WIDTH",
              severity: "error",
              message: `Column width must be a percentage (e.g., "50%")`,
              path: `sections[${sectionIdx}].layout.columns[${colIdx}]`,
            });
          }
        }
      }
    }

    if (section.layout?.variant === "grid") {
      if (
        !section.layout.gap ||
        typeof section.layout.gap !== "number" ||
        section.layout.gap < 0
      ) {
        issues.push({
          code: "GRID_MISSING_GAP",
          severity: "error",
          message: "grid layout must define a non-negative gap",
          path: `sections[${sectionIdx}].layout`,
        });
      }
    }
  }

  // Footer must have unsubscribe token
  const footerSection = spec.sections.find((s) => s.type === "footer");
  if (footerSection) {
    let hasUnsubscribe = false;

    for (const block of footerSection.blocks) {
      if (
        block.type === "smallPrint" &&
        block.text.includes("{{unsubscribe}}")
      ) {
        hasUnsubscribe = true;
        break;
      }
    }

    if (
      !hasUnsubscribe &&
      footerSection.layout?.variant === "twoColumn" &&
      footerSection.layout.columns
    ) {
      for (const column of footerSection.layout.columns) {
        for (const block of column.blocks) {
          if (
            block.type === "smallPrint" &&
            block.text.includes("{{unsubscribe}}")
          ) {
            hasUnsubscribe = true;
            break;
          }
        }
      }
    }

    if (!hasUnsubscribe) {
      issues.push({
        code: "FOOTER_MISSING_UNSUBSCRIBE",
        severity: "error",
        message:
          "Footer must include a smallPrint block with {{unsubscribe}} token",
        path: `sections[${spec.sections.indexOf(footerSection)}]`,
      });
    }
  }

  // === WARNINGS (NON-BLOCKING) ===

  // 1. Theme drift
  if (brandContext.brand?.colors) {
    const brandPrimary = brandContext.brand.colors.primary.toLowerCase();
    const specPrimary = spec.theme.primaryColor.toLowerCase();

    if (
      brandPrimary !== specPrimary &&
      colorDistance(brandPrimary, specPrimary) > 50
    ) {
      issues.push({
        code: "THEME_COLOR_DRIFT",
        severity: "warning",
        message: `Theme primary color (${specPrimary}) differs significantly from brand primary (${brandPrimary})`,
        path: "theme.primaryColor",
      });
    }
  }

  if (brandContext.brand?.fonts) {
    const brandHeading = brandContext.brand.fonts.heading.toLowerCase();
    const specHeading = spec.theme.font.heading.toLowerCase();

    if (
      brandHeading !== "arial" &&
      specHeading !== brandHeading &&
      !specHeading.includes(brandHeading)
    ) {
      issues.push({
        code: "THEME_FONT_DRIFT",
        severity: "warning",
        message: `Theme heading font (${specHeading}) differs from brand heading font (${brandHeading})`,
        path: "theme.font.heading",
      });
    }
  }

  // 2. Campaign mismatch
  if (intent.type === "sale") {
    const hasPromoLanguage = checkForPromoLanguage(spec);
    if (!hasPromoLanguage) {
      issues.push({
        code: "SALE_MISSING_PROMO",
        severity: "warning",
        message:
          'Sale campaign should include promotional language (e.g., "save", "off", "discount")',
        path: "sections",
      });
    }
  }

  if (intent.type === "launch") {
    const hasLaunchLanguage = checkForLaunchLanguage(spec);
    if (!hasLaunchLanguage) {
      issues.push({
        code: "LAUNCH_MISSING_NEW",
        severity: "warning",
        message:
          'Launch campaign should include launch language (e.g., "new", "introducing", "discover")',
        path: "sections",
      });
    }
  }

  // 3. Content imbalance
  if (spec.sections.length > 7) {
    issues.push({
      code: "TOO_MANY_SECTIONS",
      severity: "warning",
      message: `Email has ${spec.sections.length} sections (recommended: ≤7)`,
      path: "sections",
    });
  }

  const hasTrustSection = spec.sections.some(
    (s) => s.type === "trustBar" || s.type === "testimonial"
  );
  const hasProducts =
    spec.catalog && spec.catalog.items && spec.catalog.items.length > 0;

  if (hasProducts && !hasTrustSection) {
    issues.push({
      code: "MISSING_TRUST_SECTION",
      severity: "warning",
      message:
        "Commerce emails should include social proof (trustBar or testimonial section)",
      path: "sections",
    });
  }

  // 4. Copy length
  for (let sectionIdx = 0; sectionIdx < spec.sections.length; sectionIdx++) {
    const section = spec.sections[sectionIdx];

    for (let blockIdx = 0; blockIdx < section.blocks.length; blockIdx++) {
      const block = section.blocks[blockIdx];

      if (block.type === "heading" && block.text.length > 80) {
        issues.push({
          code: "HEADING_TOO_LONG",
          severity: "warning",
          message: `Heading text is ${block.text.length} characters (recommended: ≤80)`,
          path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
        });
      }

      if (block.type === "paragraph" && block.text.length > 400) {
        issues.push({
          code: "PARAGRAPH_TOO_LONG",
          severity: "warning",
          message: `Paragraph text is ${block.text.length} characters (recommended: ≤400)`,
          path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
        });
      }
    }
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarityScore(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate color distance (simple RGB approximation)
 */
function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return 0;

  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Check if spec contains promotional language
 */
function checkForPromoLanguage(spec: EmailSpec): boolean {
  const promoKeywords = [
    "save",
    "off",
    "discount",
    "sale",
    "deal",
    "%",
    "promo",
    "offer",
  ];
  const text = extractAllText(spec).toLowerCase();

  return promoKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Check if spec contains launch language
 */
function checkForLaunchLanguage(spec: EmailSpec): boolean {
  const launchKeywords = [
    "new",
    "introducing",
    "discover",
    "launch",
    "unveil",
    "debut",
    "arrive",
    "fresh",
  ];
  const text = extractAllText(spec).toLowerCase();

  return launchKeywords.some((keyword) => text.includes(keyword));
}

/**
 * Extract all text from spec for content analysis
 */
function extractAllText(spec: EmailSpec): string {
  const texts: string[] = [spec.meta.subject, spec.meta.preheader];

  for (const section of spec.sections) {
    for (const block of section.blocks) {
      if ("text" in block && typeof block.text === "string") {
        texts.push(block.text);
      }
    }

    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      for (const column of section.layout.columns) {
        for (const block of column.blocks) {
          if ("text" in block && typeof block.text === "string") {
            texts.push(block.text);
          }
        }
      }
    }
  }

  return texts.join(" ");
}
