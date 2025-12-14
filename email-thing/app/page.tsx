"use client";

import { useState } from "react";
import type { BrandContext } from "@/lib/types";
import type { CampaignIntent } from "@/lib/llm/schemas/campaignIntent";
import type { EmailPlan } from "@/lib/llm/schemas/emailPlan";
import type { EmailSpec } from "@/lib/schemas/emailSpec";
import { BrandProfile } from "./components/BrandProfile";
import CampaignIntentCard from "./components/CampaignIntentCard";
import EmailPlanCard from "./components/EmailPlanCard";
import EmailSpecViewer from "./components/EmailSpecViewer";
import EmailPreview from "./components/EmailPreview";
import type { ValidationIssue } from "@/lib/validators/emailSpec";

type ViewState = "form" | "loading" | "success" | "error";
type IntentState = "idle" | "loading" | "success" | "error";
type PlanState = "idle" | "loading" | "success" | "error";
type SpecState = "idle" | "loading" | "success" | "error";
type RenderState = "idle" | "loading" | "success" | "error";

interface ErrorResponse {
  code: string;
  message: string;
}

export default function Home() {
  const [brandUrl, setBrandUrl] = useState("");
  const [viewState, setViewState] = useState<ViewState>("form");
  const [brandContext, setBrandContext] = useState<BrandContext | null>(null);
  const [error, setError] = useState<ErrorResponse | null>(null);

  // Campaign intent state
  const [campaignPrompt, setCampaignPrompt] = useState("");
  const [intentState, setIntentState] = useState<IntentState>("idle");
  const [campaignIntent, setCampaignIntent] = useState<CampaignIntent | null>(
    null
  );
  const [intentError, setIntentError] = useState<ErrorResponse | null>(null);

  // Email plan state
  const [planState, setPlanState] = useState<PlanState>("idle");
  const [emailPlan, setEmailPlan] = useState<EmailPlan | null>(null);
  const [planError, setPlanError] = useState<ErrorResponse | null>(null);

  // Email spec state
  const [specState, setSpecState] = useState<SpecState>("idle");
  const [emailSpec, setEmailSpec] = useState<EmailSpec | null>(null);
  const [specError, setSpecError] = useState<ErrorResponse | null>(null);

  // Email render state
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [renderedMjml, setRenderedMjml] = useState<string>("");
  const [renderWarnings, setRenderWarnings] = useState<ValidationIssue[]>([]);
  const [mjmlErrors, setMjmlErrors] = useState<Array<{ message: string }>>([]);
  const [renderError, setRenderError] = useState<ErrorResponse | null>(null);

  // Quick paste state
  const [quickPasteJson, setQuickPasteJson] = useState<string>("");
  const [quickPasteValid, setQuickPasteValid] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!brandUrl.trim()) {
      setError({ code: "INVALID_URL", message: "Please enter a URL" });
      setViewState("error");
      return;
    }

    setViewState("loading");
    setError(null);

    try {
      const response = await fetch("/api/brand/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: brandUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error);
        setViewState("error");
        return;
      }

      setBrandContext(data.brandContext);
      setViewState("success");
    } catch {
      setError({
        code: "INTERNAL",
        message: "Failed to connect to the server. Please try again.",
      });
      setViewState("error");
    }
  };

  const handleParseIntent = async () => {
    if (!campaignPrompt.trim() || !brandContext) {
      setIntentError({
        code: "INVALID_PROMPT",
        message: "Please enter a campaign description",
      });
      setIntentState("error");
      return;
    }

    setIntentState("loading");
    setIntentError(null);

    try {
      const response = await fetch("/api/campaign/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandContext,
          prompt: campaignPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIntentError(data.error);
        setIntentState("error");
        return;
      }

      setCampaignIntent(data.intent);
      setIntentState("success");
    } catch {
      setIntentError({
        code: "INTERNAL",
        message: "Failed to connect to the server. Please try again.",
      });
      setIntentState("error");
    }
  };

  const handlePlanEmail = async () => {
    if (!brandContext || !campaignIntent) {
      setPlanError({
        code: "INVALID_INPUT",
        message: "Brand context and campaign intent are required",
      });
      setPlanState("error");
      return;
    }

    setPlanState("loading");
    setPlanError(null);

    try {
      const response = await fetch("/api/email/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandContext,
          intent: campaignIntent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPlanError(data.error);
        setPlanState("error");
        return;
      }

      setEmailPlan(data.plan);
      setPlanState("success");
    } catch {
      setPlanError({
        code: "INTERNAL",
        message: "Failed to connect to the server. Please try again.",
      });
      setPlanState("error");
    }
  };

  const handleReset = () => {
    setBrandUrl("");
    setBrandContext(null);
    setError(null);
    setViewState("form");
    setCampaignPrompt("");
    setCampaignIntent(null);
    setIntentError(null);
    setIntentState("idle");
    setEmailPlan(null);
    setPlanError(null);
    setPlanState("idle");
  };

  const handleNewCampaign = () => {
    setCampaignPrompt("");
    setCampaignIntent(null);
    setIntentError(null);
    setIntentState("idle");
    setEmailPlan(null);
    setPlanError(null);
    setPlanState("idle");
  };

  const handleNewPlan = () => {
    setEmailPlan(null);
    setPlanError(null);
    setPlanState("idle");
    setEmailSpec(null);
    setSpecError(null);
    setSpecState("idle");
  };

  const handleGenerateSpec = async () => {
    if (!brandContext || !campaignIntent || !emailPlan) {
      setSpecError({
        code: "INVALID_INPUT",
        message: "Brand context, campaign intent, and email plan are required",
      });
      setSpecState("error");
      return;
    }

    setSpecState("loading");
    setSpecError(null);

    try {
      // Debug: Log the request payload
      console.log("Generating email spec with:", {
        brandContext: brandContext ? "✓" : "✗",
        intent: campaignIntent ? "✓" : "✗",
        plan: emailPlan ? "✓" : "✗",
      });

      const payload = {
        brandContext,
        intent: campaignIntent,
        plan: emailPlan,
      };

      // Log a sample of the actual data for debugging
      console.log("Payload sample:", {
        brandContext: brandContext ? {
          brandName: brandContext.brand.name,
          hasColors: !!brandContext.brand.colors,
          hasFonts: !!brandContext.brand.fonts,
          catalogCount: brandContext.catalog?.length || 0,
        } : null,
        intent: campaignIntent ? {
          type: campaignIntent.type,
          hasGoal: !!campaignIntent.goal,
        } : null,
        plan: emailPlan ? {
          sectionsCount: emailPlan.sections?.length || 0,
          hasSubject: !!emailPlan.subject,
          hasPreheader: !!emailPlan.preheader,
        } : null,
      });

      const response = await fetch("/api/email/spec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setSpecError(data.error);
        setSpecState("error");
        return;
      }

      setEmailSpec(data.spec);
      setSpecState("success");
    } catch {
      setSpecError({
        code: "INTERNAL",
        message: "Failed to connect to the server. Please try again.",
      });
      setSpecState("error");
    }
  };

  const handleNewSpec = () => {
    setEmailSpec(null);
    setSpecError(null);
    setSpecState("idle");
    setRenderState("idle");
    setRenderedHtml("");
    setRenderedMjml("");
    setRenderWarnings([]);
    setMjmlErrors([]);
    setRenderError(null);
  };

  const handleRenderPreview = async () => {
    if (!emailSpec) {
      setRenderError({
        code: "INVALID_INPUT",
        message: "Email spec is required",
      });
      setRenderState("error");
      return;
    }

    setRenderState("loading");
    setRenderError(null);

    try {
      const response = await fetch("/api/email/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec: emailSpec,
          brandContext: brandContext, // Pass brandContext for hero image enhancement
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRenderError(data.error);
        setRenderState("error");
        return;
      }

      setRenderedHtml(data.html);
      setRenderedMjml(data.mjml);
      setRenderWarnings(data.warnings || []);
      setMjmlErrors(data.mjmlErrors || []);
      setRenderState("success");
    } catch {
      setRenderError({
        code: "INTERNAL",
        message: "Failed to connect to the server. Please try again.",
      });
      setRenderState("error");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
            Brand Profile Analyzer
          </h1>
          <p className="text-lg text-slate-600">
            Extract brand context from any e-commerce website
          </p>
        </header>

        {/* Quick Render Section */}
        <div className="mb-8 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            ⚡ Quick Render: Paste EmailSpec JSON
          </h2>
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={quickPasteJson}
                placeholder='Paste your EmailSpec JSON here... e.g., { "meta": { ... }, "theme": { ... }, "sections": [ ... ] }'
                className={`w-full rounded-md border px-4 py-2.5 font-mono text-sm ${
                  quickPasteValid && quickPasteJson
                    ? "border-green-500 bg-green-50"
                    : "border-slate-300 bg-white"
                }`}
                rows={6}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuickPasteJson(value);
                  
                  try {
                    const parsed = JSON.parse(value);
                    setEmailSpec(parsed);
                    setQuickPasteValid(true);
                    setSpecState("success");
                  } catch {
                    setEmailSpec(null);
                    setQuickPasteValid(false);
                  }
                }}
              />
              {quickPasteValid && quickPasteJson && (
                <div className="absolute right-3 top-3 text-green-600">
                  ✓ Valid JSON
                </div>
              )}
            </div>
            <button
              onClick={handleRenderPreview}
              disabled={!emailSpec || renderState === "loading"}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {renderState === "loading" ? "Rendering..." : "Render Email Preview"}
            </button>
            {!quickPasteValid && quickPasteJson && (
              <p className="text-sm text-red-600">
                Invalid JSON. Please check your input.
              </p>
            )}
            {renderState === "error" && renderError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h3 className="text-sm font-medium text-red-800">
                  {renderError.code}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {renderError.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Render Preview */}
        {renderState === "success" && renderedHtml && (
          <div className="mb-8">
            <EmailPreview
              html={renderedHtml}
              mjml={renderedMjml}
              warnings={renderWarnings}
              mjmlErrors={mjmlErrors}
            />
          </div>
        )}

        {/* Form Card */}
        {(viewState === "form" || viewState === "error") && (
          <div className="rounded-lg bg-white p-8 shadow-md">
            <div className="space-y-6">
              {/* Brand URL Input */}
              <div>
                <label
                  htmlFor="brandUrl"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Brand Website URL
                </label>
                <input
                  id="brandUrl"
                  type="url"
                  placeholder="https://www.allbirds.com"
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAnalyze();
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Enter the homepage URL of the brand you want to analyze
                </p>
              </div>

              {/* Error State */}
              {viewState === "error" && error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      <svg
                        className="h-5 w-5 text-red-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        {error.code}
                      </h3>
                      <p className="mt-1 text-sm text-red-700">
                        {error.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={!brandUrl.trim()}
                className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Analyze Brand
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {viewState === "loading" && (
          <div className="rounded-lg bg-white p-8 shadow-md">
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
                <p className="text-lg font-medium text-slate-700">
                  Analyzing brand...
                </p>
              </div>
              <div className="space-y-3">
                <SkeletonLine width="75%" />
                <SkeletonLine width="90%" />
                <SkeletonLine width="60%" />
              </div>
              <p className="text-center text-sm text-slate-500">
                This may take up to 10 seconds
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {viewState === "success" && brandContext && (
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-8 shadow-md">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  Brand Profile
                </h2>
                <button
                  onClick={handleReset}
                  className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Analyze Another
                </button>
              </div>
              <BrandProfile brandContext={brandContext} />
            </div>

            {/* Campaign Intent Section */}
            {intentState !== "success" && (
              <div className="rounded-lg bg-white p-8 shadow-md">
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  Generate Campaign Intent
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  Describe the email campaign you want to create
                </p>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="campaignPrompt"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Campaign Description
                    </label>
                    <textarea
                      id="campaignPrompt"
                      rows={4}
                      placeholder="e.g., make me an email for my 50% sale ending tonight"
                      value={campaignPrompt}
                      onChange={(e) => setCampaignPrompt(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Intent Error State */}
                  {intentState === "error" && intentError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="flex gap-3">
                        <div className="shrink-0">
                          <svg
                            className="h-5 w-5 text-red-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-red-800">
                            {intentError.code}
                          </h3>
                          <p className="mt-1 text-sm text-red-700">
                            {intentError.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Intent Loading State */}
                  {intentState === "loading" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-3 border-blue-300 border-t-blue-600" />
                        <p className="text-sm font-medium text-blue-800">
                          Parsing campaign intent...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Parse Intent Button */}
                  <button
                    onClick={handleParseIntent}
                    disabled={
                      !campaignPrompt.trim() || intentState === "loading"
                    }
                    className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {intentState === "loading" ? "Parsing..." : "Parse Intent"}
                  </button>
                </div>
              </div>
            )}

            {/* Campaign Intent Card */}
            {intentState === "success" && campaignIntent && (
              <div className="space-y-6">
                <CampaignIntentCard
                  intent={campaignIntent}
                  onAnalyzeAnother={handleNewCampaign}
                />

                {/* Plan Email Section */}
                {planState !== "success" && (
                  <div className="rounded-lg bg-white p-8 shadow-md">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">
                      Generate Email Plan
                    </h2>
                    <p className="text-sm text-slate-600 mb-4">
                      Create a structured email outline based on your brand and
                      campaign intent
                    </p>

                    <div className="space-y-4">
                      {/* Plan Error State */}
                      {planState === "error" && planError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                          <div className="flex gap-3">
                            <div className="shrink-0">
                              <svg
                                className="h-5 w-5 text-red-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-red-800">
                                {planError.code}
                              </h3>
                              <p className="mt-1 text-sm text-red-700">
                                {planError.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Plan Loading State */}
                      {planState === "loading" && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-3 border-blue-300 border-t-blue-600" />
                            <p className="text-sm font-medium text-blue-800">
                              Generating email plan...
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Plan Email Button */}
                      <button
                        onClick={handlePlanEmail}
                        disabled={planState === "loading"}
                        className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {planState === "loading" ? "Planning..." : "Plan Email"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Email Plan Card */}
                {planState === "success" && emailPlan && (
                  <div className="space-y-6">
                    <EmailPlanCard plan={emailPlan} onNewPlan={handleNewPlan} />

                    {/* Generate Email Spec Section */}
                    {specState !== "success" && (
                      <div className="rounded-lg bg-white p-8 shadow-md">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">
                          Generate Email Spec
                        </h2>
                        <p className="text-sm text-slate-600 mb-4">
                          Create the canonical EmailSpec JSON that defines the
                          email structure
                        </p>

                        <div className="space-y-4">
                          {/* Spec Error State */}
                          {specState === "error" && specError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                              <div className="flex gap-3">
                                <div className="shrink-0">
                                  <svg
                                    className="h-5 w-5 text-red-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-sm font-medium text-red-800">
                                    {specError.code}
                                  </h3>
                                  <p className="mt-1 text-sm text-red-700">
                                    {specError.message}
                                  </p>
                                  {/* Show validation details if available */}
                                  {(specError as any).details && (
                                    <details className="mt-2">
                                      <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                                        View validation details
                                      </summary>
                                      <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
                                        {JSON.stringify((specError as any).details, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Spec Loading State */}
                          {specState === "loading" && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-5 w-5 animate-spin rounded-full border-3 border-blue-300 border-t-blue-600" />
                                <p className="text-sm font-medium text-blue-800">
                                  Generating email spec...
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Generate Spec Button */}
                          <button
                            onClick={handleGenerateSpec}
                            disabled={specState === "loading"}
                            className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {specState === "loading"
                              ? "Generating..."
                              : "Generate Email Spec"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Email Spec Viewer */}
                    {specState === "success" && emailSpec && (
                      <div className="space-y-6">
                        <EmailSpecViewer spec={emailSpec} />

                        {/* Render Preview Section */}
                        {renderState !== "success" && (
                          <div className="rounded-lg bg-white p-8 shadow-md">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">
                              Render Email Preview
                            </h2>
                            <p className="text-sm text-slate-600 mb-4">
                              Convert the EmailSpec JSON to MJML and responsive
                              HTML for preview and export
                            </p>

                            <div className="space-y-4">
                              {/* Render Error State */}
                              {renderState === "error" && renderError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                                  <div className="flex gap-3">
                                    <div className="shrink-0">
                                      <svg
                                        className="h-5 w-5 text-red-600"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <h3 className="text-sm font-medium text-red-800">
                                        {renderError.code}
                                      </h3>
                                      <p className="mt-1 text-sm text-red-700">
                                        {renderError.message}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Render Loading State */}
                              {renderState === "loading" && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-5 w-5 animate-spin rounded-full border-3 border-blue-300 border-t-blue-600" />
                                    <p className="text-sm font-medium text-blue-800">
                                      Rendering email preview...
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Render Preview Button */}
                              <button
                                onClick={handleRenderPreview}
                                disabled={renderState === "loading"}
                                className="w-full rounded-md bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {renderState === "loading"
                                  ? "Rendering..."
                                  : "Render Preview"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Email Preview */}
                        {renderState === "success" && renderedHtml && (
                          <EmailPreview
                            html={renderedHtml}
                            mjml={renderedMjml}
                            warnings={renderWarnings}
                            mjmlErrors={mjmlErrors}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            PR8 - EmailSpec Renderer (JSON → MJML → HTML)
          </h2>
          <p className="text-sm text-slate-600">
            This interface extracts brand context from e-commerce websites,
            parses campaign intent from natural language prompts, generates
            structured email plans, creates canonical EmailSpec JSON, validates
            and repairs specs, and renders them to responsive email HTML via
            MJML. Preview the email in an iframe and export HTML/MJML for use in
            your email service provider.
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div className="h-4 animate-pulse rounded bg-slate-200" style={{ width }} />
  );
}
