"use client";

import { EmailSpec } from "../../lib/schemas/emailSpec";
import { Block } from "../../lib/schemas/blocks";
import { ValidationIssue } from "../../lib/validators/emailSpec";

export interface EmailSpecViewerProps {
  spec: EmailSpec;
  warnings?: ValidationIssue[];
}

/**
 * Display EmailSpec with visual breakdown and warnings
 */
export function EmailSpecViewer({ spec, warnings = [] }: EmailSpecViewerProps) {
  return (
    <div className="space-y-6">
      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-yellow-800">
                {warnings.length}{" "}
                {warnings.length === 1 ? "Warning" : "Warnings"}
              </h3>
            </div>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
              Non-blocking
            </span>
          </div>
          <ul className="space-y-2">
            {warnings.map((warning, idx) => (
              <li
                key={idx}
                className="text-sm text-yellow-700 flex items-start gap-2"
              >
                <span className="font-mono text-xs bg-yellow-100 px-2 py-0.5 rounded mt-0.5">
                  {warning.code}
                </span>
                <div className="flex-1">
                  <p>{warning.message}</p>
                  {warning.path && (
                    <p className="text-xs text-yellow-600 mt-1 font-mono">
                      at {warning.path}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Email Metadata</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Subject Line
            </label>
            <p className="text-lg font-medium mt-1">{spec.meta.subject}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Preheader
            </label>
            <p className="text-sm text-gray-700 mt-1">{spec.meta.preheader}</p>
          </div>
        </div>
      </div>

      {/* Theme Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Theme & Design Tokens</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Colors
            </label>
            <div className="mt-2 space-y-2">
              <ColorSwatch label="Primary" color={spec.theme.primaryColor} />
              <ColorSwatch
                label="Background"
                color={spec.theme.backgroundColor}
              />
              <ColorSwatch label="Text" color={spec.theme.textColor} />
              <ColorSwatch
                label="Muted Text"
                color={spec.theme.mutedTextColor}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Typography
            </label>
            <div className="mt-2 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Heading:</span>{" "}
                {spec.theme.font.heading}
              </div>
              <div className="text-sm">
                <span className="font-medium">Body:</span>{" "}
                {spec.theme.font.body}
              </div>
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 block">
              Button Style
            </label>
            <div className="mt-2 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Radius:</span>{" "}
                {spec.theme.button.radius}px
              </div>
              <div className="text-sm">
                <span className="font-medium">Style:</span>{" "}
                {spec.theme.button.style}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">
          Sections ({spec.sections.length})
        </h2>
        <div className="space-y-4">
          {spec.sections.map((section, idx) => (
            <div key={section.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-500">
                    #{idx + 1}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                    {section.type}
                  </span>
                  {section.layout && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                      {section.layout.variant}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {section.id}
                </span>
              </div>

              {/* Blocks */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Blocks ({section.blocks.length})
                </label>
                <div className="space-y-1">
                  {section.blocks.map((block, blockIdx) => (
                    <div
                      key={blockIdx}
                      className="text-sm flex items-center gap-2 pl-4"
                    >
                      <span className="w-20 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                        {block.type}
                      </span>
                      <span className="text-gray-600 truncate">
                        {getBlockPreview(block)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Two-column blocks */}
                {section.layout?.variant === "twoColumn" &&
                  section.layout.columns && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {section.layout.columns.map((column, colIdx) => (
                        <div
                          key={colIdx}
                          className="border-l-2 border-gray-200 pl-3"
                        >
                          <div className="text-xs text-gray-500 mb-1">
                            Column {colIdx + 1} ({column.width})
                          </div>
                          {column.blocks.map((block, blockIdx) => (
                            <div
                              key={blockIdx}
                              className="text-sm flex items-center gap-2 mb-1"
                            >
                              <span className="w-20 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                                {block.type}
                              </span>
                              <span className="text-gray-600 truncate text-xs">
                                {getBlockPreview(block)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog */}
      {spec.catalog && spec.catalog.items.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">
            Product Catalog ({spec.catalog.items.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {spec.catalog.items.map((product) => (
              <div
                key={product.id}
                className="border rounded p-3 flex items-start gap-3"
              >
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {product.title}
                  </p>
                  <p className="text-sm text-gray-600">{product.price}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    ID: {product.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON Export */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Raw JSON</h2>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
            }}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded"
          >
            Copy JSON
          </button>
        </div>
        <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-xs">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Color swatch component
 */
function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xs font-mono">{color}</div>
      </div>
    </div>
  );
}

/**
 * Get preview text for a block
 */
function getBlockPreview(block: Block): string {
  switch (block.type) {
    case "logo":
      return "Logo";
    case "heading":
      return (
        block.text.substring(0, 50) + (block.text.length > 50 ? "..." : "")
      );
    case "paragraph":
      return (
        block.text.substring(0, 50) + (block.text.length > 50 ? "..." : "")
      );
    case "button":
      return `"${block.text}" → ${block.href}`;
    case "productCard":
      return `Product: ${block.productRef}`;
    case "image":
      return "Image";
    case "divider":
      return "—";
    case "spacer":
      return `${block.size}px`;
    case "smallPrint":
      return (
        block.text.substring(0, 50) + (block.text.length > 50 ? "..." : "")
      );
    default:
      return "";
  }
}
