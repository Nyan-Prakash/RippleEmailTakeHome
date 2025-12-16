"use client";

import { useState, useMemo } from "react";
import type { ValidationIssue } from "@/lib/validators/emailSpec";

interface EmailPreviewProps {
  html: string;
  mjml: string;
  warnings: ValidationIssue[];
  mjmlErrors?: Array<{ message: string }>;
}

// Popular Google Fonts for the dropdown
const AVAILABLE_FONTS = [
  { name: "Original (from spec)", value: "" },
  { name: "Inter", value: "Inter" },
  { name: "Roboto", value: "Roboto" },
  { name: "Open Sans", value: "Open Sans" },
  { name: "Lato", value: "Lato" },
  { name: "Montserrat", value: "Montserrat" },
  { name: "Poppins", value: "Poppins" },
  { name: "Raleway", value: "Raleway" },
  { name: "Source Sans Pro", value: "Source Sans Pro" },
  { name: "Work Sans", value: "Work Sans" },
  { name: "Nunito", value: "Nunito" },
  { name: "PT Sans", value: "PT Sans" },
  { name: "Rubik", value: "Rubik" },
  { name: "DM Sans", value: "DM Sans" },
  { name: "Ubuntu", value: "Ubuntu" },
  { name: "Playfair Display", value: "Playfair Display" },
  { name: "Merriweather", value: "Merriweather" },
  { name: "Oswald", value: "Oswald" },
  { name: "Mukta", value: "Mukta" },
  { name: "Manrope", value: "Manrope" },
  { name: "Space Grotesk", value: "Space Grotesk" },
  { name: "Plus Jakarta Sans", value: "Plus Jakarta Sans" },
  { name: "Arial", value: "Arial" },
  { name: "Helvetica", value: "Helvetica" },
  { name: "Times New Roman", value: "Times New Roman" },
  { name: "Georgia", value: "Georgia" },
];

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
  const [selectedFont, setSelectedFont] = useState<string>("");
  
  // Modify HTML to override fonts if a font is selected
  const modifiedHtml = useMemo(() => {
    if (!selectedFont || !html) return html;
    
    const fontFamily = selectedFont === "Arial" || selectedFont === "Helvetica" || 
                       selectedFont === "Times New Roman" || selectedFont === "Georgia"
      ? selectedFont
      : `${selectedFont}, Arial, sans-serif`;
    
    // Generate Google Fonts link for non-system fonts
    const fontLink = selectedFont !== "Arial" && 
                     selectedFont !== "Helvetica" && 
                     selectedFont !== "Times New Roman" && 
                     selectedFont !== "Georgia"
      ? `<link href="https://fonts.googleapis.com/css2?family=${selectedFont.replace(/\s+/g, '+')}:wght@400;600;700&display=swap" rel="stylesheet">`
      : '';
    
    // Inject font override styles
    const styleOverride = `
      <style>
        * { 
          font-family: ${fontFamily} !important; 
        }
      </style>
    `;
    
    // Insert before closing head tag, or at the start of body if no head
    if (html.includes('</head>')) {
      return html.replace('</head>', `${fontLink}${styleOverride}</head>`);
    } else if (html.includes('<body')) {
      return html.replace('<body', `${fontLink}${styleOverride}<body`);
    } else {
      return fontLink + styleOverride + html;
    }
  }, [html, selectedFont]);

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
            {/* Font Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label htmlFor="font-selector" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Override Font:
                </label>
                <select
                  id="font-selector"
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  {AVAILABLE_FONTS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.name}
                    </option>
                  ))}
                </select>
                {selectedFont && (
                  <button
                    onClick={() => setSelectedFont("")}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            
            {/* Preview iframe */}
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
              <iframe
                srcDoc={modifiedHtml}
                title="Email Preview"
                className="w-full h-150 bg-white"
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
