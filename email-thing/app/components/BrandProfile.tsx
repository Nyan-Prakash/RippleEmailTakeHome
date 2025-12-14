/**
 * PR3: Brand Profile Component
 * Displays extracted brand context in a clean, production-ready UI
 */

import type { BrandContext } from "@/lib/types";

interface BrandProfileProps {
  brandContext: BrandContext;
}

export function BrandProfile({ brandContext }: BrandProfileProps) {
  const { brand, catalog } = brandContext;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start gap-4">
        {brand.logoUrl && (
          <div className="flex-shrink-0">
            <img
              src={brand.logoUrl}
              alt={`${brand.name} logo`}
              className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-white p-2"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">{brand.name}</h2>
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {brand.website}
          </a>
        </div>
      </div>

      {/* Color Palette */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Color Palette
        </h3>
        <div className="flex gap-3">
          <ColorSwatch label="Primary" color={brand.colors.primary} />
          <ColorSwatch label="Background" color={brand.colors.background} />
          <ColorSwatch label="Text" color={brand.colors.text} />
        </div>
      </div>

      {/* Typography */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Typography
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 w-20">Heading:</span>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-800">
              {typeof brand.fonts.heading === "string" ? brand.fonts.heading : brand.fonts.heading.name}
            </code>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 w-20">Body:</span>
            <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-800">
              {typeof brand.fonts.body === "string" ? brand.fonts.body : brand.fonts.body.name}
            </code>
          </div>
        </div>
      </div>

      {/* Voice Hints */}
      {brand.voiceHints && brand.voiceHints.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Voice & Tone
          </h3>
          <ul className="space-y-1">
            {brand.voiceHints.slice(0, 5).map((hint, idx) => (
              <li key={idx} className="text-sm text-slate-600 flex gap-2">
                <span className="text-slate-400">•</span>
                <span className="flex-1">{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Product Catalog */}
      {catalog.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Product Catalog ({catalog.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {catalog.map((product) => (
              <a
                key={product.id}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-md"
              >
                {product.image && (
                  <div className="mb-2 aspect-square overflow-hidden rounded bg-slate-50">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                )}
                <h4 className="mb-1 text-xs font-medium text-slate-900 line-clamp-2">
                  {product.title}
                </h4>
                <p className="text-xs font-semibold text-slate-600">
                  {product.price}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {catalog.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">
            No products found on the homepage. Products may be loaded
            dynamically or require deeper navigation.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Color swatch component
 */
function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-12 w-12 rounded-lg border border-slate-300 shadow-sm"
        style={{ backgroundColor: color }}
        title={color}
      />
      <div className="text-center">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{color}</p>
      </div>
    </div>
  );
}
