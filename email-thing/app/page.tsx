"use client";

import { useState } from "react";
import type { BrandContext } from "@/lib/types";
import type { CampaignIntent } from "@/lib/llm/schemas/campaignIntent";
import { BrandProfile } from "./components/BrandProfile";
import CampaignIntentCard from "./components/CampaignIntentCard";

type ViewState = "form" | "loading" | "success" | "error";
type IntentState = "idle" | "loading" | "success" | "error";

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

  const handleReset = () => {
    setBrandUrl("");
    setBrandContext(null);
    setError(null);
    setViewState("form");
    setCampaignPrompt("");
    setCampaignIntent(null);
    setIntentError(null);
    setIntentState("idle");
  };

  const handleNewCampaign = () => {
    setCampaignPrompt("");
    setCampaignIntent(null);
    setIntentError(null);
    setIntentState("idle");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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
                    <div className="flex-shrink-0">
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
                        <div className="flex-shrink-0">
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
              <CampaignIntentCard
                intent={campaignIntent}
                onAnalyzeAnother={handleNewCampaign}
              />
            )}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            PR4 - Campaign Intent Parser
          </h2>
          <p className="text-sm text-slate-600">
            This interface extracts brand context from e-commerce websites and
            parses campaign intent from natural language prompts. Future PRs
            will add email planning and generation capabilities.
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
