import type { EmailPlan } from "../../lib/llm/schemas/emailPlan";

interface EmailPlanCardProps {
  plan: EmailPlan;
  onNewPlan?: () => void;
}

export default function EmailPlanCard({ plan, onNewPlan }: EmailPlanCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Email Plan</h2>
        {onNewPlan && (
          <button
            onClick={onNewPlan}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            New Plan
          </button>
        )}
      </div>

      {/* Subject Lines */}
      <div className="space-y-3">
        <div>
          <span className="text-sm font-medium text-gray-600">
            Primary Subject
          </span>
          <p className="text-lg font-medium mt-1">{plan.subject.primary}</p>
        </div>
        {plan.subject.alternatives.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-600">
              Alternative Subjects
            </span>
            <div className="mt-2 space-y-1">
              {plan.subject.alternatives.map((alt, idx) => (
                <p
                  key={idx}
                  className="text-sm text-gray-700 pl-4 border-l-2 border-gray-300"
                >
                  {alt}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preheader */}
      <div>
        <span className="text-sm font-medium text-gray-600">Preheader</span>
        <p className="text-base mt-1 text-gray-700">{plan.preheader}</p>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm font-medium text-gray-600">Template</span>
          <p className="text-base capitalize mt-1 inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full">
            {plan.layout.template.replace(/_/g, " ")}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Density</span>
          <p className="text-base capitalize mt-1 inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
            {plan.layout.density}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div>
        <span className="text-sm font-medium text-gray-600">
          Sections ({plan.sections.length})
        </span>
        <div className="mt-3 space-y-3">
          {plan.sections.map((section, idx) => (
            <div
              key={section.id}
              className="p-4 bg-gray-50 border border-gray-200 rounded-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-500">
                      {idx + 1}.
                    </span>
                    <span className="text-sm font-medium capitalize px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      {section.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    {section.purpose}
                  </p>
                  {section.headline && (
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Headline: &quot;{section.headline}&quot;
                    </p>
                  )}
                  {section.bodyGuidance && (
                    <p className="text-xs text-gray-600 italic mb-2">
                      {section.bodyGuidance}
                    </p>
                  )}
                  {section.cta && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">CTA:</span>
                      <span className="text-sm font-medium px-2 py-1 bg-green-100 text-green-800 rounded">
                        {section.cta.label}
                      </span>
                      {section.cta.hrefHint && (
                        <span className="text-xs text-gray-500">
                          → {section.cta.hrefHint}
                        </span>
                      )}
                    </div>
                  )}
                  {section.productIds && section.productIds.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">
                        Products: {section.productIds.join(", ")}
                      </span>
                    </div>
                  )}
                  {section.styleHints && section.styleHints.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {section.styleHints.map((hint, hintIdx) => (
                        <span
                          key={hintIdx}
                          className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded"
                        >
                          {hint}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Products */}
      {plan.selectedProducts.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-600">
            Selected Products ({plan.selectedProducts.length})
          </span>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.selectedProducts.map((product) => (
              <div
                key={product.id}
                className="p-3 bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-md"
              >
                <div className="flex gap-3">
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.title}
                    </p>
                    {product.price && (
                      <p className="text-sm font-semibold text-green-700">
                        {product.price}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1 italic">
                      {product.whyThisProduct}
                    </p>
                    {product.url && (
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View product →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalization */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            Personalization Level
          </span>
          <span className="text-sm capitalize px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
            {plan.personalization.level}
          </span>
        </div>
        {plan.personalization.ideas.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-gray-500">Ideas:</span>
            <ul className="mt-1 space-y-1">
              {plan.personalization.ideas.map((idea, idx) => (
                <li
                  key={idx}
                  className="text-sm text-gray-700 pl-4 border-l-2 border-yellow-300"
                >
                  {idea}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Compliance */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
        <span className="text-sm font-medium text-gray-600">Compliance</span>
        <div className="mt-2 space-y-1 text-xs text-gray-600">
          <p>✓ Unsubscribe link required</p>
          <p>✓ Physical address hint required</p>
          {plan.compliance.claimsToAvoid &&
            plan.compliance.claimsToAvoid.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-700">Claims to avoid:</p>
                <ul className="mt-1 space-y-0.5">
                  {plan.compliance.claimsToAvoid.map((claim, idx) => (
                    <li key={idx} className="text-red-600">
                      • {claim}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      {/* Rationale and Confidence */}
      <div className="pt-4 border-t space-y-2">
        <div>
          <span className="text-sm font-medium text-gray-600">
            AI Rationale
          </span>
          <p className="text-sm text-gray-700 mt-1 italic">{plan.rationale}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Confidence</span>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${plan.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round(plan.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
