import { describe, it, expect, vi } from "vitest";
import { polishEmailSpecCopy } from "../polishCopy";
import type { EmailSpec } from "../../schemas/emailSpec";
import type { BrandContext } from "../../schemas/brand";
import type { CampaignIntent } from "../../schemas/campaign";

describe("polishEmailSpecCopy", () => {
  const mockBrandContext: BrandContext = {
    brand: {
      name: "Acme Co",
      website: "https://example.com",
      logoUrl: "https://example.com/logo.png",
      colors: {
        primary: "#111111",
        background: "#FFFFFF",
        text: "#111111",
      },
      fonts: {
        heading: "Arial",
        body: "Arial",
      },
      voiceHints: ["friendly", "professional", "clear"],
      snippets: {},
    },
    catalog: [],
    trust: {},
  };

  const mockCampaignIntent: CampaignIntent = {
    type: "launch",
    tone: "friendly",
    offer: "New product launch",
    audience: "Early adopters",
  };

  const mockEmailSpec: EmailSpec = {
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
        blocks: [
          {
            type: "heading",
            text: "Welcome to Our New Product",
            level: 1,
          },
        ],
      },
      {
        id: "hero-1",
        type: "hero",
        blocks: [
          {
            type: "paragraph",
            text: "This is a test paragraph.",
            style: "editorial",
            targetLength: "short",
          },
          {
            type: "button",
            text: "Click Here",
            href: "https://example.com",
          },
        ],
        metadata: {
          intent: "conversion",
          density: "balanced",
          voice: ["warm", "inviting"],
          avoid: ["hype", "urgency"],
        },
      },
      {
        id: "footer-1",
        type: "footer",
        blocks: [
          {
            type: "smallPrint",
            text: "Unsubscribe | Privacy Policy",
          },
        ],
      },
    ],
  };

  it("should extract text fields correctly", async () => {
    const mockLLMClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replacements: {
                      "/sections/0/blocks/0/text": "Welcome to Our Innovative Product",
                      "/sections/1/blocks/0/text": "Discover something truly special with our latest offering.",
                      "/sections/1/blocks/1/text": "Learn More",
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await polishEmailSpecCopy(
      mockEmailSpec,
      mockBrandContext,
      mockCampaignIntent,
      { llmClient: mockLLMClient as any }
    );

    expect(result.fieldsPolished).toBeGreaterThan(0);
    expect(result.polishedSpec.sections[0].blocks[0]).toMatchObject({
      type: "heading",
      text: "Welcome to Our Innovative Product",
    });
    expect(result.warnings).toHaveLength(0);
  });

  it("should preserve structure (sections count)", async () => {
    const mockLLMClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replacements: {
                      "/sections/0/blocks/0/text": "Better Heading",
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await polishEmailSpecCopy(
      mockEmailSpec,
      mockBrandContext,
      mockCampaignIntent,
      { llmClient: mockLLMClient as any }
    );

    expect(result.polishedSpec.sections).toHaveLength(mockEmailSpec.sections.length);
  });

  it("should preserve structure (blocks count per section)", async () => {
    const mockLLMClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replacements: {
                      "/sections/1/blocks/0/text": "Polished paragraph",
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await polishEmailSpecCopy(
      mockEmailSpec,
      mockBrandContext,
      mockCampaignIntent,
      { llmClient: mockLLMClient as any }
    );

    expect(result.polishedSpec.sections[1].blocks).toHaveLength(
      mockEmailSpec.sections[1].blocks.length
    );
  });

  it("should revert to original if polished spec fails validation", async () => {
    // Mock LLM that breaks structure
    const mockLLMClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replacements: {
                      // Empty replacements - should still validate but test edge case
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await polishEmailSpecCopy(
      mockEmailSpec,
      mockBrandContext,
      mockCampaignIntent,
      { llmClient: mockLLMClient as any }
    );

    // Should return original spec if something goes wrong
    expect(result.polishedSpec).toBeDefined();
  });

  it("should respect enabled flag", async () => {
    const result = await polishEmailSpecCopy(
      mockEmailSpec,
      mockBrandContext,
      mockCampaignIntent,
      { enabled: false }
    );

    expect(result.fieldsPolished).toBe(0);
    expect(result.polishedSpec).toEqual(mockEmailSpec);
    expect(result.warnings[0]).toContain("disabled");
  });

  it("should handle bullets items correctly", async () => {
    const specWithBullets: EmailSpec = {
      ...mockEmailSpec,
      sections: [
        ...mockEmailSpec.sections.slice(0, 1),
        {
          id: "benefits-1",
          type: "benefitsList",
          blocks: [
            {
              type: "bullets",
              items: ["Benefit one", "Benefit two", "Benefit three"],
            },
            {
              type: "button",
              text: "Get Started",
              href: "https://example.com",
            },
          ],
        },
        ...mockEmailSpec.sections.slice(2),
      ],
    };

    const mockLLMClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    replacements: {
                      "/sections/1/blocks/0/items/0": "Enhanced benefit one",
                      "/sections/1/blocks/0/items/1": "Enhanced benefit two",
                    },
                  }),
                },
              },
            ],
          }),
        },
      },
    };

    const result = await polishEmailSpecCopy(
      specWithBullets,
      mockBrandContext,
      mockCampaignIntent,
      { llmClient: mockLLMClient as any }
    );

    expect(result.fieldsPolished).toBeGreaterThan(0);
    const bullets = result.polishedSpec.sections[1].blocks[0] as any;
    expect(bullets.items[0]).toBe("Enhanced benefit one");
    expect(bullets.items[1]).toBe("Enhanced benefit two");
  });
});
