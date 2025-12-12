import type { EmailSpec } from "../schemas/emailSpec";

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  path?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate EmailSpec structural requirements
 *
 * Checks:
 * 1. At least one CTA button exists outside footer
 * 2. Footer section exists
 * 3. Footer contains smallPrint block with {{unsubscribe}} token
 * 4. Product references in productCard blocks exist in catalog (if catalog provided)
 * 5. Section IDs are unique
 */
export function validateEmailSpecStructure(
  emailSpec: EmailSpec
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Check 1: At least one CTA button outside footer
  let hasCtaOutsideFooter = false;
  const nonFooterSections = emailSpec.sections.filter(
    (s) => s.type !== "footer"
  );

  for (const section of nonFooterSections) {
    const hasButton = section.blocks.some((block) => block.type === "button");
    if (hasButton) {
      hasCtaOutsideFooter = true;
      break;
    }

    // Check in two-column layouts
    if (section.layout?.variant === "twoColumn" && section.layout.columns) {
      for (const column of section.layout.columns) {
        const hasButton = column.blocks.some(
          (block) => block.type === "button"
        );
        if (hasButton) {
          hasCtaOutsideFooter = true;
          break;
        }
      }
    }
  }

  if (!hasCtaOutsideFooter) {
    issues.push({
      severity: "error",
      message: "Email must include at least one CTA button outside the footer",
      path: "sections",
    });
  }

  // Check 2 & 3: Footer section with unsubscribe token
  const footerSection = emailSpec.sections.find((s) => s.type === "footer");

  if (!footerSection) {
    issues.push({
      severity: "error",
      message: "Email must include a footer section",
      path: "sections",
    });
  } else {
    // Check for smallPrint with unsubscribe token
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

    // Check in two-column layouts
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
        severity: "error",
        message:
          "Footer must include a smallPrint block with {{unsubscribe}} token",
        path: `sections[${emailSpec.sections.indexOf(footerSection)}]`,
      });
    }
  }

  // Check 4: Product references exist in catalog
  if (emailSpec.catalog) {
    const productIds = new Set(emailSpec.catalog.items.map((p) => p.id));

    emailSpec.sections.forEach((section, sectionIdx) => {
      section.blocks.forEach((block, blockIdx) => {
        if (block.type === "productCard") {
          if (!productIds.has(block.productRef)) {
            issues.push({
              severity: "error",
              message: `Product reference "${block.productRef}" not found in catalog`,
              path: `sections[${sectionIdx}].blocks[${blockIdx}]`,
            });
          }
        }
      });

      // Check in two-column layouts
      if (section.layout?.variant === "twoColumn" && section.layout.columns) {
        section.layout.columns.forEach((column, colIdx) => {
          column.blocks.forEach((block, blockIdx) => {
            if (block.type === "productCard") {
              if (!productIds.has(block.productRef)) {
                issues.push({
                  severity: "error",
                  message: `Product reference "${block.productRef}" not found in catalog`,
                  path: `sections[${sectionIdx}].layout.columns[${colIdx}].blocks[${blockIdx}]`,
                });
              }
            }
          });
        });
      }
    });
  }

  // Check 5: Section IDs are unique
  const sectionIds = emailSpec.sections.map((s) => s.id);
  const duplicateIds = sectionIds.filter(
    (id, index) => sectionIds.indexOf(id) !== index
  );

  if (duplicateIds.length > 0) {
    issues.push({
      severity: "error",
      message: `Duplicate section IDs found: ${[...new Set(duplicateIds)].join(", ")}`,
      path: "sections",
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
