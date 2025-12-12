import { describe, it, expect } from "vitest";
import { EmailPlanSchema } from "../plan";
import emailPlanExample from "../../../spec/examples/emailPlan.example.json";

describe("EmailPlan Schema", () => {
  it("validates the example fixture", () => {
    const result = EmailPlanSchema.safeParse(emailPlanExample);
    expect(result.success).toBe(true);
  });

  it("requires at least 3 sections", () => {
    const tooFew = {
      campaignType: "sale",
      goal: "Test goal with enough characters",
      sections: [{ type: "header" }, { type: "footer" }],
    };

    const result = EmailPlanSchema.safeParse(tooFew);
    expect(result.success).toBe(false);
  });

  it("requires header, hero, and footer sections", () => {
    const missingHero = {
      campaignType: "sale",
      goal: "Test goal with enough characters",
      sections: [
        { type: "header" },
        { type: "productGrid" },
        { type: "footer" },
      ],
    };

    const result = EmailPlanSchema.safeParse(missingHero);
    expect(result.success).toBe(false);
  });

  it("validates productGrid count range", () => {
    const validCount = {
      campaignType: "sale",
      goal: "Test goal with enough characters",
      sections: [
        { type: "header" },
        { type: "hero" },
        { type: "productGrid", count: 4 },
        { type: "footer" },
      ],
    };

    const result = EmailPlanSchema.safeParse(validCount);
    expect(result.success).toBe(true);
  });

  it("rejects productGrid count outside 2-8 range", () => {
    const invalidCount = {
      campaignType: "sale",
      goal: "Test goal with enough characters",
      sections: [
        { type: "header" },
        { type: "hero" },
        { type: "productGrid", count: 10 },
        { type: "footer" },
      ],
    };

    const result = EmailPlanSchema.safeParse(invalidCount);
    expect(result.success).toBe(false);
  });

  it("validates goal length constraints", () => {
    const tooShort = {
      campaignType: "sale",
      goal: "Short",
      sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }],
    };

    const result = EmailPlanSchema.safeParse(tooShort);
    expect(result.success).toBe(false);
  });

  it("accepts valid plan with all required sections", () => {
    const valid = {
      campaignType: "launch",
      goal: "Introduce new product line to existing customers",
      sections: [
        { type: "header" },
        { type: "hero" },
        { type: "feature" },
        { type: "trustBar" },
        { type: "footer" },
      ],
    };

    const result = EmailPlanSchema.parse(valid);
    expect(result.sections).toHaveLength(5);
  });
});
