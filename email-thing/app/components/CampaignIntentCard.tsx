import type { CampaignIntent } from "../../lib/llm/schemas/campaignIntent";

interface CampaignIntentCardProps {
  intent: CampaignIntent;
  onAnalyzeAnother?: () => void;
}

export default function CampaignIntentCard({
  intent,
  onAnalyzeAnother,
}: CampaignIntentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Campaign Intent</h2>
        {onAnalyzeAnother && (
          <button
            onClick={onAnalyzeAnother}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            New Campaign
          </button>
        )}
      </div>

      {/* Type and Goal */}
      <div className="space-y-3">
        <div>
          <span className="text-sm font-medium text-gray-600">
            Campaign Type
          </span>
          <p className="text-lg capitalize">{intent.type.replace(/_/g, " ")}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Goal</span>
          <p className="text-lg">{intent.goal}</p>
        </div>
        {intent.audience && (
          <div>
            <span className="text-sm font-medium text-gray-600">
              Target Audience
            </span>
            <p className="text-lg">{intent.audience}</p>
          </div>
        )}
      </div>

      {/* Tone and Urgency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm font-medium text-gray-600">Tone</span>
          <p className="text-base capitalize mt-1 inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
            {intent.tone}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Urgency</span>
          <p className="text-base capitalize mt-1 inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
            {intent.urgency}
          </p>
        </div>
      </div>

      {/* Offer */}
      {intent.offer && intent.offer.kind !== "none" && (
        <div>
          <span className="text-sm font-medium text-gray-600">Offer</span>
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="font-medium capitalize">
              {intent.offer.kind.replace(/_/g, " ")}
              {intent.offer.value &&
                `: ${intent.offer.value}${intent.offer.kind === "percent" ? "%" : ""}`}
            </p>
            {intent.offer.details && (
              <p className="text-sm text-gray-700 mt-1">
                {intent.offer.details}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Time Window */}
      {intent.timeWindow &&
        (intent.timeWindow.start || intent.timeWindow.end) && (
          <div>
            <span className="text-sm font-medium text-gray-600">
              Time Window
            </span>
            <div className="mt-2 space-y-1">
              {intent.timeWindow.start && (
                <p className="text-sm">
                  <span className="font-medium">Start:</span>{" "}
                  {new Date(intent.timeWindow.start).toLocaleString()}
                </p>
              )}
              {intent.timeWindow.end && (
                <p className="text-sm">
                  <span className="font-medium">End:</span>{" "}
                  {new Date(intent.timeWindow.end).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

      {/* CTAs */}
      <div>
        <span className="text-sm font-medium text-gray-600">
          Call to Action
        </span>
        <div className="mt-2 space-y-2">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
            <span className="text-xs text-blue-600 font-medium">Primary:</span>
            <p className="font-medium">{intent.cta.primary}</p>
          </div>
          {intent.cta.secondary && (
            <div className="p-2 bg-gray-50 border border-gray-200 rounded">
              <span className="text-xs text-gray-600 font-medium">
                Secondary:
              </span>
              <p className="font-medium">{intent.cta.secondary}</p>
            </div>
          )}
        </div>
      </div>

      {/* Keywords */}
      {intent.keywords.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-600">Keywords</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {intent.keywords.map((keyword, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {intent.constraints && intent.constraints.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-600">Constraints</span>
          <ul className="mt-2 list-disc list-inside space-y-1">
            {intent.constraints.map((constraint, idx) => (
              <li key={idx} className="text-sm text-gray-700">
                {constraint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rationale and Confidence */}
      <div className="pt-4 border-t space-y-2">
        <div>
          <span className="text-sm font-medium text-gray-600">
            AI Rationale
          </span>
          <p className="text-sm text-gray-700 mt-1 italic">
            {intent.rationale}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-600">Confidence</span>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${intent.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round(intent.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
