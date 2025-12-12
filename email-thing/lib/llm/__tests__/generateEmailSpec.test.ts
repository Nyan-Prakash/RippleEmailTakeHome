import { describe, it, expect, vi } from "vitest";
import {
  generateEmailSpec,
  GenerateEmailSpecLLMClient,
} from "../generateEmailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../../schemas/campaign";
import type { EmailPlan } from "../../schemas/plan";

describe("generateEmailSpec", () => {
  const mockBrandContext: BrandContext = {
    brand: {
      name: "Test Brand",
      website: "https://test.com",
      logoUrl: "https://test.com/logo.png",
      colors: {
        primary: "#111111",
        background: "#FFFFFF",
        text: "#111111",
      },
      fonts: {
        heading: "Arial",
        body: "Arial",
      },
      voiceHints: [],
      snippets: {},
    },
    catalog: [],
    trust: {},
  };

  const mockIntent: CampaignIntent = {
    type: "sale",
    tone: "premium",
  };

  const mockPlan: EmailPlan = {
    campaignType: "sale",
    goal: "Drive sales",
    sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }],
  };

  const validEmailSpecJson = JSON.stringify({
    meta: {
      subject: "Test Subject Line",
      preheader: "Test preheader text here",
    },
    theme: {
      containerWidth: 600,
      backgroundColor: "#FFFFFF",
      surfaceColor: "#F5F5F5",
      textColor: "#111111",
      mutedTextColor: "#666666",
      primaryColor: "#111111",
      font: {
        heading: "Arial",
        body: "Arial",
      },
      button: {
        radius: 8,
        style: "solid",
      },
    },
    sections: [
      {
        id: "header-1",
        type: "header",
        blocks: [
          {
            type: "logo",
            src: "https://test.com/logo.png",
          },
        ],
      },
      {
        id: "hero-1",
        type: "hero",
        blocks: [
          { type: "heading", text: "Welcome to Our Sale", level: 1 },
          {
            type: "button",
            text: "Shop Now",
            href: "https://test.com/shop",
          },
        ],
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "{{unsubscribe}}",
            align: "center",
          },
        ],
      },
    ],
  });

  it("should generate valid EmailSpec with mocked LLM on first attempt", async () => {
    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi.fn().mockResolvedValue(validEmailSpecJson),
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(result.spec).toBeDefined();
    expect(result.spec.meta.subject).toBe("Test Subject Line");
    expect(result.spec.sections).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(1);
  });

  it("should handle invalid JSON output and throw error", async () => {
    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi.fn().mockResolvedValue("invalid json {"),
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow("Invalid JSON output");
  });

  it("should retry on validation failure and succeed on second attempt", async () => {
    const invalidSpec = JSON.stringify({
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        // Missing header first - will fail structural validation
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
    });

    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce(invalidSpec)
        .mockResolvedValueOnce(validEmailSpecJson),
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(result.spec).toBeDefined();
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
    expect(result.warnings).toBeDefined();
  });

  it("should throw LLM_OUTPUT_INVALID after max attempts exhausted", async () => {
    const invalidSpec = JSON.stringify({
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        // Always missing header
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
    });

    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi.fn().mockResolvedValue(invalidSpec),
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow("Failed to generate valid EmailSpec after 3 attempts");

    expect(mockLLM.completeJson).toHaveBeenCalledTimes(3);
  });

  it("should succeed with warnings for non-blocking issues", async () => {
    const specWithWarnings = JSON.stringify({
      meta: {
        subject: "Test Subject Line",
        preheader: "Test preheader text here",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#FF0000", // Different from brand color - will warn
        font: {
          heading: "Comic Sans", // Different from brand font - will warn
          body: "Arial",
        },
        button: {
          radius: 8,
          style: "solid",
        },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "hero-1",
          type: "hero",
          blocks: [
            { type: "heading", text: "Welcome to Our Sale", level: 1 },
            {
              type: "button",
              text: "Shop Now",
              href: "https://test.com/shop",
            },
          ],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            {
              type: "smallPrint",
              text: "{{unsubscribe}}",
              align: "center",
            },
          ],
        },
      ],
    });

    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi.fn().mockResolvedValue(specWithWarnings),
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(result.spec).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(1);
  });

  it("should converge after 2 attempts with proper repair", async () => {
    const firstAttempt = JSON.stringify({
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        // Missing footer
      ],
    });

    const secondAttempt = JSON.stringify({
      meta: {
        subject: "Test Subject",
        preheader: "Test preheader text",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "header-1",
          type: "header",
          blocks: [],
        },
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
    });

    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi
        .fn()
        .mockResolvedValueOnce(firstAttempt)
        .mockResolvedValueOnce(secondAttempt),
    };

    const result = await generateEmailSpec({
      brandContext: mockBrandContext,
      intent: mockIntent,
      plan: mockPlan,
      deps: { llm: mockLLM },
    });

    expect(result.spec).toBeDefined();
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
  });

  it("should stop on repeated same error (convergence failure)", async () => {
    const sameErrorSpec = JSON.stringify({
      meta: {
        subject: "Test",
        preheader: "Test preheader",
      },
      theme: {
        containerWidth: 600,
        backgroundColor: "#FFFFFF",
        surfaceColor: "#F5F5F5",
        textColor: "#111111",
        mutedTextColor: "#666666",
        primaryColor: "#111111",
        font: { heading: "Arial", body: "Arial" },
        button: { radius: 8, style: "solid" },
      },
      sections: [
        {
          id: "hero-1",
          type: "hero",
          blocks: [{ type: "button", text: "Shop", href: "https://test.com" }],
        },
        {
          id: "hero-1", // Duplicate ID - same error every time
          type: "feature",
          blocks: [],
        },
        {
          id: "footer-1",
          type: "footer",
          blocks: [
            { type: "smallPrint", text: "{{unsubscribe}}", align: "center" },
          ],
        },
      ],
    });

    const mockLLM: GenerateEmailSpecLLMClient = {
      completeJson: vi.fn().mockResolvedValue(sameErrorSpec),
    };

    await expect(
      generateEmailSpec({
        brandContext: mockBrandContext,
        intent: mockIntent,
        plan: mockPlan,
        deps: { llm: mockLLM },
      })
    ).rejects.toThrow("same errors repeated");

    // Should stop before max attempts due to convergence failure
    expect(mockLLM.completeJson).toHaveBeenCalledTimes(2);
  });
});
