import type { EmailSpec } from "../schemas/emailSpec";
import type { BrandContext } from "../schemas/brand";
import type { CampaignIntent } from "../schemas/campaign";
import type { EmailPlan } from "../schemas/plan";
import { getLuminance, getContrastRatio } from "../theme/deriveTheme";

/**
 * Validation severity
 */
export type ValidationSeverity = "error" | "warning";

/**
 * Validation issue
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
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Helper to calculate color difference (simple RGB distance)
 */
function colorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  
  return Math.sqrt(
    Math.pow(r2 - r1, 2) + 
    Math.pow(g2 - g1, 2) + 
    Math.pow(b2 - b1, 2)
  );
}

/**
 * Helper for simple string similarity (Levenshtein-ish)
 */
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Validate EmailSpec structural requirements with comprehensive checks
 * 
 * Performs blocking error checks and non-blocking warning checks
 * 
 * @param args - Validation arguments including spec and context
 * @returns ValidationResult with ok flag and issues array
 */
export function validateEmailSpecStructure(args: {
  spec: EmailSpec;
  brandContext: BrandContext;
  intent: CampaignIntent;
  plan: EmailPlan;
}): ValidationResult {
  const { spec, brandContext, intent, plan } = args;
  const issues: ValidationIssue[] = [];

  // ===== BLOCKING ERRORS =====
  
  // 1. Section ordering: header must be first, footer must be last
  if (spec.sections.length > 0) {
    const firstSection = spec.sections[0];
    if (firstSection.type !== "header") {
      issues.push({
        code: "HEADER_NOT_FIRST",
        severity: "error",
        message: "Header section must be the first section",
        path: "sections[0]",
      });
    }

    const lastSection = spec.sections[spec.sections.length - 1];
    if (lastSection.type !== "footer") {
      issues.push({
        code: "FOOTER_NOT_LAST",
        severity: "error",
        message: "Footer section must be the last section",
        path: `sections[${spec.sections.length - 1}]`,
      });
    }
  }

  // 2. Logo validity
  spec.sections.forEach((section, sectionIdx) => {
    const checkLogoBlock = (block: any, blockIdx: number, path: string) => {
      if (block.type === "logo") {
        if (!block.src || block.src.trim() === "") {
          issues.push({
            code: "LOGO_MISSING_SRC",
            severity: "error",
            message: "Logo block must have a non-empty src URL",
            path: `${path}.blocks[${blockIdx}]`,
          });
        } else {
          // Check if it's a valid URL
          try {
            new URL(block.src);
          } catch {
            issues.push({
              code: "LOGO_INVALID_URL",
              severity: "error",
              message: `Logo src is not a valid URL: ${block.src}`,
              path: `${path}.blocks[${blockIdx}]`,
            });
          }
        }
      }
    };

    section.blocks.forEach((block, blockIdx) => {
      checkLogoBlock(block, blockIdx, `sections[${sectionIdx}]`);
    });

    // Check in two-column layouts
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      section.layout.columns.forEach((column, colIdx) => {
        column.blocks.forEach((block, blockIdx) => {
          checkLogoBlock(block, blockIdx, `sections[${sectionIdx}].layout.columns[${colIdx}]`);
        });
      });
    }
  });

  // 3. CTA sanity: at least one button with non-empty text and href
  let hasValidCta = false;
  const buttons: any[] = [];

  const collectButtons = (blocks: any[]) => {
    blocks.forEach(block => {
      if (block.type === "button") {
        buttons.push(block);
        if (block.text && block.text.trim() !== "" && block.href && block.href.trim() !== "") {
          hasValidCta = true;
        }
      }
    });
  };

  spec.sections.forEach(section => {
    collectButtons(section.blocks);
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      section.layout.columns.forEach(column => collectButtons(column.blocks));
    }
  });

  if (!hasValidCta) {
    issues.push({
      code: "MISSING_VALID_CTA",
      severity: "error",
      message: "Email must include at least one button block with non-empty text and href",
      path: "sections",
    });
  }

  // Check if button text roughly matches intent CTA
  if (intent.ctaText && buttons.length > 0) {
    const hasMatchingCta = buttons.some(button => {
      return stringSimilarity(button.text, intent.ctaText!) > 0.4;
    });

    if (!hasMatchingCta) {
      issues.push({
        code: "CTA_TEXT_MISMATCH",
        severity: "error",
        message: `Button text should roughly match intent CTA: "${intent.ctaText}"`,
        path: "sections",
      });
    }
  }

  // 4. Product alignment
  const catalogProductIds = new Set(spec.catalog?.items?.map(p => p.id) || []);
  const planProductIds = new Set(
    plan.sections
      .filter(s => s.type === "productGrid")
      .flatMap(() => brandContext.catalog.slice(0, 4).map(p => p.id))
  );

  spec.sections.forEach((section, sectionIdx) => {
    const checkProductCard = (block: any, blockIdx: number, path: string) => {
      if (block.type === "productCard") {
        // Must only appear in productGrid or hero
        if (section.type !== "productGrid" && section.type !== "hero") {
          issues.push({
            code: "PRODUCT_CARD_MISPLACED",
            severity: "warning",
            message: `Product card found in ${section.type} section. Usually placed in productGrid or hero`,
            path: `${path}.blocks[${blockIdx}]`,
          });
        }

        // Must reference items in spec.catalog
        if (!catalogProductIds.has(block.productRef)) {
          issues.push({
            code: "INVALID_PRODUCT_REF",
            severity: "error",
            message: `Product reference "${block.productRef}" not found in catalog`,
            path: `${path}.blocks[${blockIdx}]`,
          });
        }
      }
    };

    section.blocks.forEach((block, blockIdx) => {
      checkProductCard(block, blockIdx, `sections[${sectionIdx}]`);
    });

    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      section.layout.columns.forEach((column, colIdx) => {
        column.blocks.forEach((block, blockIdx) => {
          checkProductCard(block, blockIdx, `sections[${sectionIdx}].layout.columns[${colIdx}]`);
        });
      });
    }
  });

  // If plan selected products, spec catalog must include them
  if (planProductIds.size > 0 && spec.catalog) {
    planProductIds.forEach(productId => {
      if (!catalogProductIds.has(productId)) {
        issues.push({
          code: "PLAN_PRODUCT_MISSING",
          severity: "error",
          message: `Plan referenced product "${productId}" but it's not in spec catalog`,
          path: "catalog",
        });
      }
    });
  }

  // 5. Duplicate section IDs
  const sectionIds = spec.sections.map(s => s.id);
  const duplicateIds = sectionIds.filter((id, index) => sectionIds.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    issues.push({
      code: "DUPLICATE_SECTION_IDS",
      severity: "error",
      message: `Duplicate section IDs found: ${[...new Set(duplicateIds)].join(", ")}`,
      path: "sections",
    });
  }

  // 6. Layout correctness
  spec.sections.forEach((section, sectionIdx) => {
    if (section.layout?.variant === "twoColumn") {
      if (!section.layout.columns || section.layout.columns.length !== 2) {
        issues.push({
          code: "TWO_COLUMN_MISSING_COLUMNS",
          severity: "error",
          message: "Two-column layout must define exactly 2 columns",
          path: `sections[${sectionIdx}].layout`,
        });
      } else {
        // Check if widths are defined
        section.layout.columns.forEach((col, colIdx) => {
          if (!col.width || !col.width.match(/^\d+%$/)) {
            issues.push({
              code: "COLUMN_MISSING_WIDTH",
              severity: "error",
              message: "Column must define width as percentage (e.g., '50%')",
              path: `sections[${sectionIdx}].layout.columns[${colIdx}]`,
            });
          }
        });
      }
    }

    if (section.layout?.variant === "grid") {
      if (typeof section.layout.gap !== "number") {
        issues.push({
          code: "GRID_MISSING_GAP",
          severity: "error",
          message: "Grid layout must define gap",
          path: `sections[${sectionIdx}].layout`,
        });
      }
    }
  });

  // 7. Footer must have unsubscribe token
  const footerSection = spec.sections.find(s => s.type === "footer");
  if (footerSection) {
    let hasUnsubscribe = false;

    const checkUnsubscribe = (blocks: any[]) => {
      blocks.forEach(block => {
        if (block.type === "smallPrint" && block.text.includes("{{unsubscribe}}")) {
          hasUnsubscribe = true;
        }
      });
    };

    checkUnsubscribe(footerSection.blocks);
    if (footerSection.layout?.variant === "twoColumn" && footerSection.layout.columns) {
      footerSection.layout.columns.forEach(column => checkUnsubscribe(column.blocks));
    }

    if (!hasUnsubscribe) {
      issues.push({
        code: "FOOTER_MISSING_UNSUBSCRIBE",
        severity: "error",
        message: "Footer must include a smallPrint block with {{unsubscribe}} token",
        path: `sections[${spec.sections.indexOf(footerSection)}]`,
      });
    }
  }

  // ===== NON-BLOCKING WARNINGS =====

  // Check for products (used in multiple warnings below)
  const hasProducts = (spec.catalog?.items?.length || 0) > 0;

  // 1. Background monotony: warn if 3+ consecutive sections share same background
  const sectionBackgrounds = spec.sections.map((section, idx) => ({
    idx,
    background: section.style?.background || "bg",
  }));

  for (let i = 0; i < sectionBackgrounds.length - 2; i++) {
    const bg1 = sectionBackgrounds[i].background;
    const bg2 = sectionBackgrounds[i + 1].background;
    const bg3 = sectionBackgrounds[i + 2].background;

    if (bg1 === bg2 && bg2 === bg3) {
      issues.push({
        code: "BACKGROUND_MONOTONY",
        severity: "warning",
        message: `Sections ${i}-${i + 2} have the same background (${bg1}). Consider alternating backgrounds for visual variety`,
        path: `sections[${i}]`,
      });
      // Skip ahead to avoid duplicate warnings
      i += 2;
    }
  }

  // 2. Too few sections
  const minSections = intent.type === "sale" || intent.type === "launch" ? 7 : 6;
  if (spec.sections.length < minSections) {
    issues.push({
      code: "TOO_FEW_SECTIONS",
      severity: "warning",
      message: `Email has only ${spec.sections.length} sections. Consider adding more content (recommended: ${minSections}+)`,
      path: "sections",
    });
  }

  // 3. No secondary CTA
  const hasMidpointCta = spec.sections.some((section, idx) => {
    if (idx < spec.sections.length / 2) return false;
    const allBlocks = section.blocks;
    return allBlocks.some(block => block.type === "button");
  });

  const hasSecondaryCTA = spec.sections.some(s => s.type === "secondaryCTA");

  if (!hasSecondaryCTA && !hasMidpointCta) {
    issues.push({
      code: "MISSING_SECONDARY_CTA",
      severity: "warning",
      message: "Email should include a secondary CTA after midpoint or a secondaryCTA section",
      path: "sections",
    });
  }

  // 4. No social proof for ecommerce
  const hasSocialProofGrid = spec.sections.some(s => s.type === "socialProofGrid");
  const hasTestimonial = spec.sections.some(s => s.type === "testimonial");

  if (hasProducts && !hasSocialProofGrid && !hasTestimonial) {
    issues.push({
      code: "ECOMMERCE_MISSING_SOCIAL_PROOF",
      severity: "warning",
      message: "Ecommerce emails should include socialProofGrid or testimonial section",
      path: "sections",
    });
  }

  // 5. Theme drift - colors
  const brandPrimary = brandContext.brand.colors.primary;
  const specPrimary = spec.theme.primaryColor;
  
  if (colorDistance(brandPrimary, specPrimary) > 100) {
    issues.push({
      code: "THEME_COLOR_DRIFT",
      severity: "warning",
      message: `Spec primary color (${specPrimary}) differs significantly from brand primary (${brandPrimary})`,
      path: "theme.primaryColor",
    });
  }

  // Theme drift - fonts
  const brandHeadingFont = brandContext.brand.fonts.heading.toLowerCase();
  const specHeadingFont = spec.theme.font.heading.toLowerCase();

  if (brandHeadingFont !== specHeadingFont && !specHeadingFont.includes(brandHeadingFont.split(",")[0])) {
    issues.push({
      code: "THEME_FONT_DRIFT",
      severity: "warning",
      message: `Spec heading font (${spec.theme.font.heading}) differs from brand font (${brandContext.brand.fonts.heading})`,
      path: "theme.font.heading",
    });
  }

  // 6. Contrast warnings (WCAG AA compliance)
  const bgInkContrast = getContrastRatio(spec.theme.backgroundColor, spec.theme.textColor);
  if (bgInkContrast < 4.5) {
    issues.push({
      code: "LOW_TEXT_CONTRAST",
      severity: "warning",
      message: `Background/text contrast is ${bgInkContrast.toFixed(1)}:1. WCAG AA recommends 4.5:1 minimum for readability`,
      path: "theme",
    });
  }

  const buttonTextContrast = getContrastRatio(spec.theme.primaryColor, spec.theme.backgroundColor);
  if (buttonTextContrast < 3.0) {
    issues.push({
      code: "LOW_BUTTON_CONTRAST",
      severity: "warning",
      message: `Button contrast is ${buttonTextContrast.toFixed(1)}:1. WCAG AA recommends 3:1 minimum for UI elements`,
      path: "theme.button",
    });
  }

  // 2. Campaign mismatch
  if (intent.type === "sale") {
    const hasPromoLanguage = JSON.stringify(spec).toLowerCase().includes("sale") ||
                            JSON.stringify(spec).toLowerCase().includes("discount") ||
                            JSON.stringify(spec).toLowerCase().includes("offer");
    
    if (!hasPromoLanguage) {
      issues.push({
        code: "SALE_MISSING_PROMO_LANGUAGE",
        severity: "warning",
        message: "Sale campaign should include promotional language (sale, discount, offer)",
        path: "meta",
      });
    }
  }

  if (intent.type === "launch") {
    const hasLaunchLanguage = JSON.stringify(spec).toLowerCase().includes("new") ||
                             JSON.stringify(spec).toLowerCase().includes("introducing") ||
                             JSON.stringify(spec).toLowerCase().includes("launch");
    
    if (!hasLaunchLanguage) {
      issues.push({
        code: "LAUNCH_MISSING_NEW_LANGUAGE",
        severity: "warning",
        message: "Launch campaign should include new/introducing/launch language",
        path: "meta",
      });
    }
  }

  // 6. Content imbalance
  if (spec.sections.length > 7) {
    issues.push({
      code: "TOO_MANY_SECTIONS",
      severity: "warning",
      message: `Email has ${spec.sections.length} sections. Consider reducing to 7 or fewer for better engagement`,
      path: "sections",
    });
  }

  // 7. Copy length warnings
  spec.sections.forEach((section, sectionIdx) => {
    const checkTextLength = (blocks: any[], path: string) => {
      blocks.forEach((block, blockIdx) => {
        if (block.type === "heading" && block.text.length > 80) {
          issues.push({
            code: "HEADING_TOO_LONG",
            severity: "warning",
            message: `Heading text is ${block.text.length} characters. Consider keeping under 80`,
            path: `${path}.blocks[${blockIdx}]`,
          });
        }
        if (block.type === "paragraph" && block.text.length > 300) {
          issues.push({
            code: "PARAGRAPH_TOO_LONG",
            severity: "warning",
            message: `Paragraph text is ${block.text.length} characters. Consider keeping under 300`,
            path: `${path}.blocks[${blockIdx}]`,
          });
        }
      });
    };

    checkTextLength(section.blocks, `sections[${sectionIdx}]`);
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      section.layout.columns.forEach((column, colIdx) => {
        checkTextLength(column.blocks, `sections[${sectionIdx}].layout.columns[${colIdx}]`);
      });
    }
  });

  return {
    ok: issues.filter(i => i.severity === "error").length === 0,
    issues,
  };
}
