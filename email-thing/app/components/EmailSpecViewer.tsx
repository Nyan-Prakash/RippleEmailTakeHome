"use client";

import type { EmailSpec } from "@/lib/schemas/emailSpec";
import type { ValidationIssue } from "@/lib/validators/emailSpec";

interface EmailSpecViewerProps {
  spec: EmailSpec;
  warnings?: ValidationIssue[];
}

export default function EmailSpecViewer({ spec, warnings = [] }: EmailSpecViewerProps) {
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Validation Warnings
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
            </span>
          </div>
          <details className="mt-2">
            <summary className="text-sm text-amber-700 cursor-pointer hover:text-amber-900">
              View details
            </summary>
            <ul className="mt-2 space-y-2">
              {warnings.map((warning, idx) => (
                <li key={idx} className="text-sm border-l-2 border-amber-300 pl-3 py-1">
                  <div className="flex items-start gap-2">
                    <span className="bg-amber-200 text-amber-800 text-xs font-mono px-2 py-0.5 rounded">
                      {warning.code}
                    </span>
                    <div className="flex-1">
                      <p className="text-amber-900">{warning.message}</p>
                      {warning.path && (
                        <p className="text-amber-600 text-xs mt-0.5 font-mono">
                          {warning.path}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* Meta Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Metadata</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Subject</label>
            <p className="text-gray-900 mt-1">{spec.meta.subject}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Preheader</label>
            <p className="text-gray-600 text-sm mt-1">{spec.meta.preheader}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Primary Color</label>
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: spec.theme.primaryColor }}
              />
              <span className="text-sm font-mono text-gray-600">
                {spec.theme.primaryColor}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Background</label>
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: spec.theme.backgroundColor }}
              />
              <span className="text-sm font-mono text-gray-600">
                {spec.theme.backgroundColor}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Text Color</label>
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: spec.theme.textColor }}
              />
              <span className="text-sm font-mono text-gray-600">
                {spec.theme.textColor}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Heading Font</label>
            <p className="text-sm text-gray-900 mt-1">{typeof spec.theme.font.heading === "string" ? spec.theme.font.heading : spec.theme.font.heading.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Body Font</label>
            <p className="text-sm text-gray-900 mt-1">{typeof spec.theme.font.body === "string" ? spec.theme.font.body : spec.theme.font.body.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Container Width</label>
            <p className="text-sm text-gray-900 mt-1">{spec.theme.containerWidth}px</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sections ({spec.sections.length})
        </h3>
        <div className="space-y-4">
          {spec.sections.map((section, idx) => (
            <details
              key={section.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <summary className="cursor-pointer font-medium text-gray-900 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {section.type}
                </span>
                <span className="text-sm text-gray-600">{section.id}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {section.blocks.length} blocks
                </span>
              </summary>
              <div className="mt-4 space-y-2">
                {section.layout && (
                  <div className="text-sm">
                    <span className="text-gray-600">Layout: </span>
                    <span className="font-mono text-gray-900">
                      {section.layout.variant}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Blocks:</p>
                  {section.blocks.map((block, blockIdx) => (
                    <div
                      key={blockIdx}
                      className="bg-gray-50 rounded p-3 text-sm border border-gray-100"
                    >
                      <span className="bg-gray-200 text-gray-800 text-xs px-2 py-0.5 rounded font-mono">
                        {block.type}
                      </span>
                      {block.type === "heading" && (
                        <p className="mt-2 text-gray-900 font-medium">{block.text}</p>
                      )}
                      {block.type === "paragraph" && (
                        <p className="mt-2 text-gray-700">{block.text}</p>
                      )}
                      {block.type === "button" && (
                        <div className="mt-2">
                          <p className="text-gray-900 font-medium">{block.text}</p>
                          <p className="text-blue-600 text-xs mt-1 break-all">
                            {block.href}
                          </p>
                        </div>
                      )}
                      {block.type === "logo" && (
                        <p className="mt-2 text-gray-700 text-xs break-all">
                          {block.src}
                        </p>
                      )}
                      {block.type === "image" && (
                        <div className="mt-2">
                          <p className="text-gray-900">{block.alt}</p>
                          <p className="text-gray-600 text-xs mt-1 break-all">
                            {block.src}
                          </p>
                        </div>
                      )}
                      {block.type === "productCard" && (
                        <p className="mt-2 text-gray-700 font-mono text-xs">
                          Ref: {block.productRef}
                        </p>
                      )}
                      {block.type === "smallPrint" && (
                        <p className="mt-2 text-gray-600 text-xs">{block.text}</p>
                      )}
                      {block.type === "spacer" && (
                        <p className="mt-2 text-gray-600 text-xs">
                          Height: {block.size}px
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Catalog */}
      {spec.catalog && spec.catalog.items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Product Catalog ({spec.catalog.items.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spec.catalog.items.map((product) => (
              <div
                key={product.id}
                className="border border-gray-200 rounded-lg p-4 flex gap-3"
              >
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {product.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{product.price}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                    ID: {product.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* JSON Export */}
      <details className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <summary className="cursor-pointer font-medium text-gray-900">
          View Raw JSON
        </summary>
        <pre className="mt-4 text-xs overflow-auto bg-white p-4 rounded border border-gray-200 max-h-96">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
