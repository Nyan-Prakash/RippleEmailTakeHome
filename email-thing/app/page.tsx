"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "error">(
    "checking"
  );

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(() => setHealthStatus("ok"))
      .catch(() => setHealthStatus("error"));
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-slate-900">
            AI Marketing Email Generator
          </h1>
          <p className="text-lg text-slate-600">
            Transform your brand and ideas into production-ready marketing
            emails
          </p>
        </header>

        {/* Status Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          <div
            className={`h-2 w-2 rounded-full ${
              healthStatus === "ok"
                ? "bg-green-500"
                : healthStatus === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span className="text-slate-600">
            Status:{" "}
            {healthStatus === "ok"
              ? "Ready"
              : healthStatus === "error"
                ? "Error"
                : "Checking..."}
          </span>
        </div>

        {/* Main Form Card */}
        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="space-y-6">
            {/* Brand URL Input */}
            <div>
              <label
                htmlFor="brandUrl"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Brand URL
              </label>
              <input
                id="brandUrl"
                type="url"
                placeholder="https://example.com"
                className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the URL of the brand website to analyze
              </p>
            </div>

            {/* Campaign Prompt */}
            <div>
              <label
                htmlFor="prompt"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Campaign Prompt
              </label>
              <textarea
                id="prompt"
                rows={4}
                placeholder="Describe your marketing campaign... (e.g., 'Create a premium launch email for our new winter jacket collection')"
                className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled
              />
              <p className="mt-1 text-xs text-slate-500">
                Describe the type of email you want to generate
              </p>
            </div>

            {/* Generate Button */}
            <button
              className="w-full rounded-md bg-slate-400 px-6 py-3 font-medium text-white transition-colors cursor-not-allowed"
              disabled
            >
              Generate Email (Coming Soon)
            </button>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            🚧 PR0 - Foundation Scaffold
          </h2>
          <p className="text-sm text-slate-600">
            This is the initial setup. Business logic (scraping, AI generation,
            rendering) will be added in subsequent PRs. See{" "}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">
              PR_ROADMAP.md
            </code>{" "}
            for the full implementation plan.
          </p>
        </div>
      </div>
    </div>
  );
}
