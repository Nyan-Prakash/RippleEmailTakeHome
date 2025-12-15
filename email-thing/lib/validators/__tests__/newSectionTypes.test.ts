import { describe, it, expect } from "vitest";
import { validateEmailSpecStructure } from "../emailSpec";
import type { EmailSpec } from "../../schemas/emailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../../schemas/campaign";
import type { EmailPlan } from "../../schemas/plan";

describe("emailSpec validator - new section types", () => {
  const mockBrandContext: BrandContext = {
    brand: {
      name: "Test Brand",
      website: "https://example.com",
      logoUrl: "",
      colors: { primary: "#111111", background: "#FFFFFF", text: "#111111" },
      fonts: { heading: "Arial", body: "Arial" },
      voiceHints: [],
      snippets: {},
    },
    catalog: [],
    trust: {},
  };

  const mockIntent: CampaignIntent = {
    type: "launch",
  };

  const mockPlan: EmailPlan = {
    campaignType: "launch",
    goal: "Test goal",
    sections: [],
  };

  const baseSpec: EmailSpec = {
    meta: {
      subject: "Test Subject",
      preheader: "Test Preheader",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      surfaceColor: "#F5F5F5",
      textColor: "#111111",
      mutedTextColor: "#666666",
      primaryColor: "#111111",
      font: { heading: "Arial", body: "Arial" },
      button: { radius: 8, style: "solid" as const, paddingY: 12, paddingX: 24 },
    },
    sections: [
      {
        id: "header-1",
        type: "header",
        blocks: [{ type: "heading", text: "Header", level: 1 }],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [{ type: "smallPrint", text: "Footer text" }],
      },
    ],
  };

  it("should warn if benefitsList has wrong number of items", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "benefits-1",
          type: "benefitsList",
          blocks: [
            {
              type: "bullets",
              items: ["One", "Two"], // Too few
            },
            {
              type: "button",
              text: "CTA",
              href: "https://example.com",
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "BENEFITS_COUNT_INVALID");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should warn if FAQ has wrong number of items", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "faq-1",
          type: "faq",
          blocks: [
            {
              type: "heading",
              text: "Q1",
              level: 3,
            },
            {
              type: "paragraph",
              text: "A1",
            },
          ], // Too few blocks
        },
        {
          id: "cta-1",
          type: "hero",
          blocks: [{ type: "button", text: "CTA", href: "https://example.com" }],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "FAQ_COUNT_INVALID");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should error if navLinks missing label or url", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        {
          id: "nav-1",
          type: "navHeader",
          blocks: [
            {
              type: "navLinks",
              links: [
                { label: "Home", url: "https://example.com" },
                { label: "About", url: "" }, // Missing URL
              ],
            },
            {
              type: "button",
              text: "CTA",
              href: "https://example.com",
            },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const error = result.issues.find((i) => i.code === "NAV_LINK_INCOMPLETE");
    expect(error).toBeDefined();
    expect(error?.severity).toBe("error");
  });

  it("should warn if storySection missing heading or body", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "story-1",
          type: "storySection",
          blocks: [
            {
              type: "image",
              src: "https://example.com/image.jpg",
              alt: "Image",
            },
          ], // Missing heading
        },
        {
          id: "cta-1",
          type: "hero",
          blocks: [{ type: "button", text: "CTA", href: "https://example.com" }],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "STORY_SECTION_INCOMPLETE");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should warn if socialProofGrid has no logos", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "social-1",
          type: "socialProofGrid",
          blocks: [
            {
              type: "heading",
              text: "Trusted by",
              level: 2,
            },
          ], // No logos
        },
        {
          id: "cta-1",
          type: "hero",
          blocks: [{ type: "button", text: "CTA", href: "https://example.com" }],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "SOCIAL_PROOF_NO_LOGOS");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should warn if too many CTAs", () => {
    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "hero-1",
          type: "hero",
          blocks: [
            { type: "heading", text: "Hero", level: 1 },
            { type: "button", text: "CTA 1", href: "https://example.com/1" },
          ],
        },
        {
          id: "feature-1",
          type: "feature",
          blocks: [
            { type: "button", text: "CTA 2", href: "https://example.com/2" },
          ],
        },
        {
          id: "feature-2",
          type: "feature",
          blocks: [
            { type: "button", text: "CTA 3", href: "https://example.com/3" },
          ],
        },
        {
          id: "feature-3",
          type: "feature",
          blocks: [
            { type: "button", text: "CTA 4", href: "https://example.com/4" },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "TOO_MANY_CTAS");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("should warn if copy is too dense", () => {
    const longText = "a".repeat(600); // Very long paragraph

    const spec: EmailSpec = {
      ...baseSpec,
      sections: [
        ...baseSpec.sections.slice(0, 1),
        {
          id: "content-1",
          type: "feature",
          blocks: [
            { type: "paragraph", text: longText },
            { type: "paragraph", text: longText },
            { type: "paragraph", text: longText },
            { type: "button", text: "CTA", href: "https://example.com" },
          ],
        },
        ...baseSpec.sections.slice(1),
      ],
    };

    const result = validateEmailSpecStructure({
      spec,
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
    });

    const warning = result.issues.find((i) => i.code === "COPY_TOO_DENSE");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });
});
