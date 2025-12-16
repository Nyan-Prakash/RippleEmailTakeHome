import { describe, it, expect, vi } from "vitest";
import { parseCampaignIntent, type LLMClient } from "../parseCampaignIntent";
import type { BrandContext } from "../../types";
import { LLMError } from "../errors";

// Mock brand context for testing
const mockBrandContext: BrandContext = {
  brand: {
    name: "Test Brand",
    website: "https://test.com",
    logoUrl: "https://test.com/logo.png",
    colors: {
      primary: "#000000",
      background: "#FFFFFF",
      text: "#333333",
    },
    fonts: {
      heading: "Arial",
      body: "Helvetica",
    },
    voiceHints: ["friendly", "professional"],
    snippets: {},
  },
  catalog: [],
  trust: {},
};

describe("parseCampaignIntent", () => {
  it("should successfully parse valid LLM output", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue({
        type: "sale",
        goal: "Drive sales for end-of-season clearance",
        urgency: "high",
        tone: "urgent",
        cta: {
          primary: "Shop Now",
        },
        keywords: ["sale", "clearance", "limited"],
        confidence: 0.9,
        rationale: "Clear sale campaign with urgency",
      }),
    };

    const result = await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "create a sale email for our clearance",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    expect(result.type).toBe("sale");
    expect(result.goal).toBe("Drive sales for end-of-season clearance");
    expect(result.urgency).toBe("high");
    expect(result.confidence).toBe(0.9);
    expect(mockLLMClient.generateJSON).toHaveBeenCalledOnce();
  });

  it("should throw INVALID_PROMPT for empty prompt", async () => {
    await expect(
      parseCampaignIntent({
        brandContext: mockBrandContext,
        prompt: "",
      })
    ).rejects.toThrow(LLMError);

    await expect(
      parseCampaignIntent({
        brandContext: mockBrandContext,
        prompt: "   ",
      })
    ).rejects.toThrow(LLMError);
  });

  it("should throw LLM_CONFIG_MISSING when no API key is provided", async () => {
    await expect(
      parseCampaignIntent(
        {
          brandContext: mockBrandContext,
          prompt: "test prompt",
        },
        {
          apiKey: undefined,
        }
      )
    ).rejects.toThrow(LLMError);
  });

  it("should throw LLM_FAILED when LLM call fails", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockRejectedValue(new Error("Network error")),
    };

    await expect(
      parseCampaignIntent(
        {
          brandContext: mockBrandContext,
          prompt: "test prompt",
        },
        {
          llmClient: mockLLMClient,
          apiKey: "test-key",
        }
      )
    ).rejects.toThrow(LLMError);
  });

  it("should throw LLM_TIMEOUT when LLM call times out", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockRejectedValue(new Error("Request timeout")),
    };

    await expect(
      parseCampaignIntent(
        {
          brandContext: mockBrandContext,
          prompt: "test prompt",
        },
        {
          llmClient: mockLLMClient,
          apiKey: "test-key",
        }
      )
    ).rejects.toThrow(LLMError);
  });

  it("should attempt repair when first validation fails", async () => {
    const invalidOutput = {
      type: "sale",
      goal: "Test goal",
      // Missing required fields
    };

    const validOutput = {
      type: "sale",
      goal: "Drive sales",
      urgency: "high",
      tone: "urgent",
      cta: {
        primary: "Shop Now",
      },
      keywords: ["sale"],
      confidence: 0.85,
      rationale: "Repaired output",
    };

    const mockLLMClient: LLMClient = {
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce(invalidOutput)
        .mockResolvedValueOnce(validOutput),
    };

    const result = await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "test prompt",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    expect(result.rationale).toBe("Repaired output");
    expect(mockLLMClient.generateJSON).toHaveBeenCalledTimes(2);
  });

  it("should throw LLM_OUTPUT_INVALID when repair also fails", async () => {
    const invalidOutput = {
      type: "sale",
      // Missing required fields
    };

    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue(invalidOutput),
    };

    await expect(
      parseCampaignIntent(
        {
          brandContext: mockBrandContext,
          prompt: "test prompt",
        },
        {
          llmClient: mockLLMClient,
          apiKey: "test-key",
        }
      )
    ).rejects.toThrow(LLMError);

    expect(mockLLMClient.generateJSON).toHaveBeenCalledTimes(2);
  });

  it("should handle complex campaign intent with all fields", async () => {
    const complexOutput = {
      type: "product_launch",
      goal: "Launch new sustainable shoe line",
      audience: "Eco-conscious millennials",
      offer: {
        kind: "percent",
        value: 20,
        details: "20% off for early adopters",
      },
      urgency: "medium",
      timeWindow: {
        start: "2024-01-15T00:00:00Z",
        end: "2024-01-31T23:59:59Z",
      },
      tone: "premium",
      cta: {
        primary: "Pre-Order Now",
        secondary: "Learn More",
      },
      constraints: ["Highlight sustainability", "Include testimonials"],
      keywords: ["sustainable", "eco-friendly", "launch", "new", "shoes"],
      confidence: 0.95,
      rationale: "Clear product launch with sustainability focus",
    };

    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue(complexOutput),
    };

    const result = await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "launch email for new sustainable shoes with 20% discount",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    expect(result.type).toBe("product_launch");
    expect(result.offer?.kind).toBe("percent");
    expect(result.offer?.value).toBe(20);
    expect(result.timeWindow?.start).toBe("2024-01-15T00:00:00Z");
    expect(result.constraints).toHaveLength(2);
    expect(result.keywords).toHaveLength(5);
  });

  it("should pass brand context to system prompt", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue({
        type: "newsletter",
        goal: "Monthly update",
        urgency: "low",
        tone: "friendly",
        cta: { primary: "Read More" },
        keywords: ["newsletter"],
        confidence: 0.8,
        rationale: "Simple newsletter",
      }),
    };

    await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "monthly newsletter",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    const mockCalls = vi.mocked(mockLLMClient.generateJSON).mock.calls;
    const callArgs = mockCalls[0][0];
    const systemMessage = callArgs.messages.find(
      (m) => m.role === "system"
    ) as { role: string; content: string };

    expect(systemMessage.content).toContain("Test Brand");
    expect(systemMessage.content).toContain("friendly");
    expect(systemMessage.content).toContain("professional");
  });

  it("should include user prompt in messages", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue({
        type: "sale",
        goal: "Test",
        urgency: "low",
        tone: "friendly",
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      }),
    };

    const userPrompt = "50% off sale ending tonight";

    await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: userPrompt,
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    const mockCalls = vi.mocked(mockLLMClient.generateJSON).mock.calls;
    const callArgs = mockCalls[0][0];
    const userMessage = callArgs.messages.find((m) => m.role === "user") as {
      role: string;
      content: string;
    };

    expect(userMessage.content).toContain(userPrompt);
  });

  it("should use correct model and parameters", async () => {
    const mockLLMClient: LLMClient = {
      generateJSON: vi.fn().mockResolvedValue({
        type: "sale",
        goal: "Test",
        urgency: "low",
        tone: "friendly",
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      }),
    };

    await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "test prompt",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    const mockCalls = vi.mocked(mockLLMClient.generateJSON).mock.calls;
    const callArgs = mockCalls[0][0];

    expect(callArgs.model).toBe("gpt-4o-mini");
    expect(callArgs.temperature).toBe(0.7);
    expect(callArgs.maxTokens).toBe(1000);
  });

  it("should use lower temperature for repair retry", async () => {
    const invalidOutput = {
      type: "sale",
      goal: "Test",
    };

    const validOutput = {
      type: "sale",
      goal: "Test",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const mockLLMClient: LLMClient = {
      generateJSON: vi
        .fn()
        .mockResolvedValueOnce(invalidOutput)
        .mockResolvedValueOnce(validOutput),
    };

    await parseCampaignIntent(
      {
        brandContext: mockBrandContext,
        prompt: "test prompt",
      },
      {
        llmClient: mockLLMClient,
        apiKey: "test-key",
      }
    );

    const mockCalls = vi.mocked(mockLLMClient.generateJSON).mock.calls;
    const repairCallArgs = mockCalls[1][0];
    expect(repairCallArgs.temperature).toBe(0.3);
  });
});
