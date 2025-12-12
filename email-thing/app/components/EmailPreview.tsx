"use client";

import { useState } from "react";
import type { ValidationIssue } from "@/lib/validators/emailSpec";

interface EmailPreviewProps {
  html: string;
  mjml: string;
  warnings: ValidationIssue[];
  mjmlErrors?: Array<{ message: string }>;
}

export default function EmailPreview({
  html,
  mjml,
  warnings,
  mjmlErrors = [],
}: EmailPreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "html" | "mjml">(
    "preview"
  );
  const [copySuccess, setCopySuccess] = useState<string>("");

  const handleCopy = async (content: string, type: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(""), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "preview"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab("html")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "html"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              HTML
            </button>
            <button
              onClick={() => setActiveTab("mjml")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "mjml"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              MJML
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "preview" && (
          <div className="space-y-4">
            {/* Preview iframe */}
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
              <iframe
                srcDoc={html}
                title="Email Preview"
                className="w-full h-[600px] bg-white"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {activeTab === "html" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => handleCopy(html, "HTML")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                {copySuccess === "HTML" ? "Copied!" : "Copy HTML"}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
              <code>{html}</code>
            </pre>
          </div>
        )}

        {activeTab === "mjml" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => handleCopy(mjml, "MJML")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                {copySuccess === "MJML" ? "Copied!" : "Copy MJML"}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
              <code>{mjml}</code>
            </pre>
          </div>
        )}

        {/* Warnings and Errors */}
        {(warnings.length > 0 || mjmlErrors.length > 0) && (
          <div className="mt-6 space-y-4">
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                  Renderer Warnings ({warnings.length})
                </h3>
                <ul className="space-y-2">
                  {warnings.map((warning, index) => (
                    <li key={index} className="text-sm text-yellow-700">
                      <span className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded">
                        {warning.code}
                      </span>
                      <span className="ml-2">{warning.message}</span>
                      {warning.path && (
                        <span className="ml-2 text-yellow-600 text-xs">
                          ({warning.path})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mjmlErrors.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-orange-800 mb-2">
                  MJML Compilation Issues ({mjmlErrors.length})
                </h3>
                <ul className="space-y-2">
                  {mjmlErrors.map((error, index) => (
                    <li key={index} className="text-sm text-orange-700">
                      {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
