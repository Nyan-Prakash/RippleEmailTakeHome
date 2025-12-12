import type { EmailSpec } from "../../lib/schemas/emailSpec";

interface EmailSpecViewerProps {
  spec: EmailSpec;
  onNewSpec?: () => void;
}

export default function EmailSpecViewer({
  spec,
  onNewSpec,
}: EmailSpecViewerProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Email Spec</h2>
        {onNewSpec && (
          <button
            onClick={onNewSpec}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            New Spec
          </button>
        )}
      </div>

      {/* Meta Information */}
      <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-md">
        <h3 className="text-lg font-semibold text-gray-800">Email Metadata</h3>
        <div>
          <span className="text-sm font-medium text-gray-600">Subject</span>
          <p className="text-lg font-medium mt-1">{spec.meta.subject}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Preheader</span>
          <p className="text-base mt-1 text-gray-700">{spec.meta.preheader}</p>
        </div>
      </div>

      {/* Theme Tokens */}
      <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-md">
        <h3 className="text-lg font-semibold text-gray-800">Theme</h3>

        {/* Colors */}
        <div>
          <span className="text-sm font-medium text-gray-600">Colors</span>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: spec.theme.backgroundColor }}
              />
              <div>
                <p className="text-xs text-gray-500">Background</p>
                <p className="text-sm font-mono">
                  {spec.theme.backgroundColor}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: spec.theme.primaryColor }}
              />
              <div>
                <p className="text-xs text-gray-500">Primary</p>
                <p className="text-sm font-mono">{spec.theme.primaryColor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: spec.theme.textColor }}
              />
              <div>
                <p className="text-xs text-gray-500">Text</p>
                <p className="text-sm font-mono">{spec.theme.textColor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: spec.theme.surfaceColor }}
              />
              <div>
                <p className="text-xs text-gray-500">Surface</p>
                <p className="text-sm font-mono">{spec.theme.surfaceColor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: spec.theme.mutedTextColor }}
              />
              <div>
                <p className="text-xs text-gray-500">Muted Text</p>
                <p className="text-sm font-mono">{spec.theme.mutedTextColor}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-600">
              Heading Font
            </span>
            <p className="text-base mt-1 font-mono text-gray-800">
              {spec.theme.font.heading}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">Body Font</span>
            <p className="text-base mt-1 font-mono text-gray-800">
              {spec.theme.font.body}
            </p>
          </div>
        </div>

        {/* Button Style */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-600">
              Button Style
            </span>
            <p className="text-base mt-1 capitalize px-3 py-1 inline-block bg-purple-100 text-purple-800 rounded-full">
              {spec.theme.button.style}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">
              Button Radius
            </span>
            <p className="text-base mt-1 px-3 py-1 inline-block bg-purple-100 text-purple-800 rounded-full">
              {spec.theme.button.radius}px
            </p>
          </div>
        </div>

        {/* Container Width */}
        <div>
          <span className="text-sm font-medium text-gray-600">
            Container Width
          </span>
          <p className="text-base mt-1 px-3 py-1 inline-block bg-purple-100 text-purple-800 rounded-full">
            {spec.theme.containerWidth}px
          </p>
        </div>
      </div>

      {/* Catalog */}
      {spec.catalog && spec.catalog.items.length > 0 && (
        <div className="space-y-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-md">
          <h3 className="text-lg font-semibold text-gray-800">
            Product Catalog ({spec.catalog.items.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {spec.catalog.items.map((product) => (
              <div
                key={product.id}
                className="p-3 bg-white border border-green-200 rounded-md"
              >
                <div className="flex gap-3">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-500">
                      {product.id}
                    </p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.title}
                    </p>
                    <p className="text-sm font-semibold text-green-700">
                      {product.price}
                    </p>
                    {product.url && (
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800">
          Sections ({spec.sections.length})
        </h3>
        <div className="space-y-3">
          {spec.sections.map((section, idx) => (
            <details
              key={section.id}
              className="p-4 bg-gray-50 border border-gray-200 rounded-md"
              open={idx === 0}
            >
              <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600">
                <div className="inline-flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-medium capitalize px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                    {section.type}
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    ({section.id})
                  </span>
                </div>
              </summary>

              <div className="mt-4 space-y-3">
                {/* Layout */}
                {section.layout && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">
                      Layout
                    </span>
                    <p className="text-sm mt-1 capitalize px-2 py-0.5 inline-block bg-indigo-100 text-indigo-800 rounded">
                      {section.layout.variant}
                    </p>
                  </div>
                )}

                {/* Style */}
                {section.style && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">
                      Style
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {section.style.paddingX !== undefined && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                          paddingX: {section.style.paddingX}
                        </span>
                      )}
                      {section.style.paddingY !== undefined && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                          paddingY: {section.style.paddingY}
                        </span>
                      )}
                      {section.style.background && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                          bg: {section.style.background}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Blocks */}
                <div>
                  <span className="text-xs font-medium text-gray-600">
                    Blocks ({section.blocks.length})
                  </span>
                  <div className="mt-2 space-y-2">
                    {section.blocks.map((block, blockIdx) => (
                      <div
                        key={blockIdx}
                        className="p-2 bg-white border border-gray-200 rounded text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-gray-500 min-w-[80px]">
                            {block.type}
                          </span>
                          <div className="flex-1">
                            {block.type === "heading" && (
                              <div>
                                <p className="font-medium">
                                  H{block.level || 2}: {block.text}
                                </p>
                                {block.align && (
                                  <span className="text-gray-500">
                                    align: {block.align}
                                  </span>
                                )}
                              </div>
                            )}
                            {block.type === "paragraph" && (
                              <div>
                                <p>{block.text}</p>
                                {block.align && (
                                  <span className="text-gray-500">
                                    align: {block.align}
                                  </span>
                                )}
                              </div>
                            )}
                            {block.type === "button" && (
                              <div>
                                <p className="font-medium">{block.text}</p>
                                <p className="text-blue-600 break-all">
                                  → {block.href}
                                </p>
                                {block.align && (
                                  <span className="text-gray-500">
                                    align: {block.align}
                                  </span>
                                )}
                              </div>
                            )}
                            {block.type === "logo" && (
                              <div>
                                <p className="break-all">{block.src}</p>
                                {block.href && (
                                  <p className="text-blue-600 break-all">
                                    link: {block.href}
                                  </p>
                                )}
                              </div>
                            )}
                            {block.type === "image" && (
                              <div>
                                <p className="font-medium">{block.alt}</p>
                                <p className="text-gray-600 break-all">
                                  {block.src}
                                </p>
                                {block.href && (
                                  <p className="text-blue-600 break-all">
                                    link: {block.href}
                                  </p>
                                )}
                              </div>
                            )}
                            {block.type === "productCard" && (
                              <div>
                                <p className="font-medium">
                                  Product: {block.productRef}
                                </p>
                                {spec.catalog?.items.find(
                                  (p) => p.id === block.productRef
                                ) && (
                                  <p className="text-gray-600">
                                    {
                                      spec.catalog.items.find(
                                        (p) => p.id === block.productRef
                                      )?.title
                                    }
                                  </p>
                                )}
                              </div>
                            )}
                            {block.type === "smallPrint" && (
                              <p className="text-gray-600">{block.text}</p>
                            )}
                            {block.type === "spacer" && (
                              <p className="text-gray-600">
                                Height: {block.size}px
                              </p>
                            )}
                            {block.type === "divider" && (
                              <p className="text-gray-600">───</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Dev Info */}
      <div className="pt-4 border-t text-xs text-gray-500">
        <p>
          This is a devtool view of the canonical EmailSpec JSON. The actual
          email preview will be rendered in a later stage.
        </p>
      </div>
    </div>
  );
}
