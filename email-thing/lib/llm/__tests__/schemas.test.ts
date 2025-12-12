import { describe, it, expect } from "vitest";
import { CampaignIntentSchema } from "../schemas/campaignIntent";

describe("CampaignIntentSchema", () => {
  it("should validate a complete valid campaign intent", () => {
    const validIntent = {
      type: "sale",
      goal: "Drive sales for end-of-season clearance",
      audience: "Existing customers who have purchased in the last 6 months",
      offer: {
        kind: "percent",
        value: 50,
        details: "Up to 50% off select items",
      },
      urgency: "high",
      timeWindow: {
        start: "2024-01-15T00:00:00Z",
        end: "2024-01-16T23:59:59Z",
      },
      tone: "urgent",
      cta: {
        primary: "Shop Sale Now",
        secondary: "Browse All Deals",
      },
      constraints: ["No mention of past promotions", "Focus on sustainability"],
      keywords: [
        "sale",
        "clearance",
        "limited-time",
        "sustainable",
        "eco-friendly",
      ],
      confidence: 0.92,
      rationale: "Clear sale campaign with specific urgency and time window",
    };

    const result = CampaignIntentSchema.safeParse(validIntent);
    expect(result.success).toBe(true);
  });

  it("should validate minimal required fields", () => {
    const minimalIntent = {
      type: "newsletter",
      goal: "Monthly newsletter",
      urgency: "low",
      tone: "friendly",
      cta: {
        primary: "Read More",
      },
      keywords: ["newsletter", "updates"],
      confidence: 0.8,
      rationale: "Simple newsletter campaign",
    };

    const result = CampaignIntentSchema.safeParse(minimalIntent);
    expect(result.success).toBe(true);
  });

  it("should reject invalid campaign type", () => {
    const invalidIntent = {
      type: "invalid_type",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject goal exceeding 120 characters", () => {
    const invalidIntent = {
      type: "sale",
      goal: "A".repeat(121),
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject audience exceeding 80 characters", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      audience: "A".repeat(81),
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject CTA primary exceeding 40 characters", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "A".repeat(41) },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject more than 6 constraints", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      constraints: ["1", "2", "3", "4", "5", "6", "7"],
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject more than 12 keywords", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: Array(13).fill("keyword"),
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject confidence outside 0-1 range", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 1.5,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should reject rationale exceeding 200 characters", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "A".repeat(201),
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should validate offer with all fields", () => {
    const intentWithOffer = {
      type: "sale",
      goal: "Test goal",
      offer: {
        kind: "fixed_amount",
        value: 25,
        details: "Save $25 on orders over $100",
      },
      urgency: "medium",
      tone: "friendly",
      cta: { primary: "Shop Now" },
      keywords: ["sale"],
      confidence: 0.85,
      rationale: "Sale campaign",
    };

    const result = CampaignIntentSchema.safeParse(intentWithOffer);
    expect(result.success).toBe(true);
  });

  it("should validate invalid datetime strings", () => {
    const invalidIntent = {
      type: "sale",
      goal: "Test goal",
      urgency: "low",
      tone: "friendly",
      timeWindow: {
        start: "invalid-date",
        end: "2024-01-16T23:59:59Z",
      },
      cta: { primary: "Click" },
      keywords: ["test"],
      confidence: 0.8,
      rationale: "Test",
    };

    const result = CampaignIntentSchema.safeParse(invalidIntent);
    expect(result.success).toBe(false);
  });

  it("should validate all valid campaign types", () => {
    const types = [
      "sale",
      "product_launch",
      "back_in_stock",
      "newsletter",
      "holiday",
      "winback",
      "announcement",
      "other",
    ];

    types.forEach((type) => {
      const intent = {
        type,
        goal: "Test goal",
        urgency: "low",
        tone: "friendly",
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      };

      const result = CampaignIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid urgency levels", () => {
    const urgencies = ["low", "medium", "high"];

    urgencies.forEach((urgency) => {
      const intent = {
        type: "sale",
        goal: "Test goal",
        urgency,
        tone: "friendly",
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      };

      const result = CampaignIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid tones", () => {
    const tones = [
      "playful",
      "premium",
      "minimal",
      "bold",
      "friendly",
      "urgent",
      "informative",
      "other",
    ];

    tones.forEach((tone) => {
      const intent = {
        type: "sale",
        goal: "Test goal",
        urgency: "low",
        tone,
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      };

      const result = CampaignIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });
  });

  it("should validate all valid offer kinds", () => {
    const offerKinds = [
      "percent",
      "fixed_amount",
      "free_shipping",
      "bogo",
      "none",
      "other",
    ];

    offerKinds.forEach((kind) => {
      const intent = {
        type: "sale",
        goal: "Test goal",
        offer: { kind },
        urgency: "low",
        tone: "friendly",
        cta: { primary: "Click" },
        keywords: ["test"],
        confidence: 0.8,
        rationale: "Test",
      };

      const result = CampaignIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });
  });
});
