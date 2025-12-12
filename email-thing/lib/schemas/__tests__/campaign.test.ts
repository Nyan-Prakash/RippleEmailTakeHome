import { describe, it, expect } from "vitest";
import { CampaignIntentSchema } from "../campaign";
import campaignIntentExample from "../../../spec/examples/campaignIntent.example.json";

describe("CampaignIntent Schema", () => {
  it("validates the example fixture", () => {
    const result = CampaignIntentSchema.safeParse(campaignIntentExample);
    expect(result.success).toBe(true);
  });

  it("applies default type when not provided", () => {
    const minimal = {};
    const result = CampaignIntentSchema.parse(minimal);
    expect(result.type).toBe("generic");
  });

  it("enforces string length limits", () => {
    const tooLong = {
      offer: "x".repeat(501), // Max 500
    };

    const result = CampaignIntentSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
  });

  it("trims whitespace from optional strings", () => {
    const withWhitespace = {
      type: "sale",
      offer: "  25% off  ",
      ctaText: "  Shop Now  ",
    };

    const result = CampaignIntentSchema.parse(withWhitespace);
    expect(result.offer).toBe("25% off");
    expect(result.ctaText).toBe("Shop Now");
  });

  it("validates all campaign types", () => {
    const types = [
      "sale",
      "launch",
      "newsletter",
      "backInStock",
      "winback",
      "abandonedCart",
      "generic",
    ];

    types.forEach((type) => {
      const result = CampaignIntentSchema.safeParse({ type });
      expect(result.success).toBe(true);
    });
  });

  it("rejects invalid campaign type", () => {
    const invalid = {
      type: "invalid-type",
    };

    const result = CampaignIntentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("validates all tone options", () => {
    const tones = [
      "playful",
      "premium",
      "minimal",
      "urgent",
      "friendly",
      "bold",
    ];

    tones.forEach((tone) => {
      const result = CampaignIntentSchema.safeParse({ tone });
      expect(result.success).toBe(true);
    });
  });
});
