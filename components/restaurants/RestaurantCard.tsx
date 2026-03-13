import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails, RestaurantInsights } from "@/lib/restaurants/restaurantProvider";
import { Card, Spinner } from "@/components/ui";

interface RestaurantCardProps {
  recommendation: ScoredRecommendation;
  onClick?: () => void;
  onSelect?: () => void;
  details?: PlaceDetails | null;
  detailsLoading?: boolean;
  selected?: boolean;
}

const WebsiteIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const linkClasses = "inline-flex items-center gap-1.5 text-xs font-medium text-black bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors";

function InsightsLoadingSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-3 bg-gray-100 rounded w-5/6" />
      <div className="flex gap-1.5 mt-2">
        <div className="h-5 bg-gray-100 rounded-full w-16" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
        <div className="h-5 bg-gray-100 rounded-full w-14" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-2/3 mt-2" />
      <div className="h-3 bg-gray-100 rounded w-3/4" />
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 shrink-0 w-20">{label}</span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: RestaurantInsights }) {
  return (
    <div className="space-y-2.5">
      {insights.summary && (
        <p className="text-sm text-gray-700 leading-relaxed">{insights.summary}</p>
      )}

      {insights.knownFor.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insights.knownFor.map((item) => (
            <span
              key={item}
              className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {insights.atmosphere && (
          <InsightRow label="Atmosphere" value={insights.atmosphere} />
        )}
        {insights.hours && (
          <InsightRow label="Hours" value={insights.hours} />
        )}
        {insights.specials && (
          <InsightRow label="Specials" value={insights.specials} />
        )}
        {insights.reviews && (
          <InsightRow label="Reviews" value={insights.reviews} />
        )}
      </div>
    </div>
  );
}

export function RestaurantCard({
  recommendation,
  onClick,
  onSelect,
  details,
  detailsLoading,
  selected,
}: RestaurantCardProps) {
  const { restaurant, explanation, is_wildcard } = recommendation;

  function handleClick() {
    onClick?.();
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        is_wildcard ? "border-amber-400" : ""
      } ${selected ? "ring-2 ring-black" : ""}`}
      onClick={handleClick}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{restaurant.name}</h3>
          <div className="flex items-center gap-2">
            {is_wildcard && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                Wildcard
              </span>
            )}
            {onSelect && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                  selected
                    ? "text-white bg-black"
                    : "text-black bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {selected ? "Selected" : "Select"}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">{restaurant.address}</p>
        <div className="flex gap-3 text-sm text-gray-600">
          {restaurant.price_level && <span>{restaurant.price_level}</span>}
          {restaurant.rating != null && (
            <span>&#9733; {restaurant.rating}</span>
          )}
          {restaurant.distance_km != null && (
            <span>{restaurant.distance_km.toFixed(1)} km</span>
          )}
        </div>
        {explanation && (
          <p className="text-sm text-gray-500 italic mt-2">{explanation}</p>
        )}

        {selected && (() => {
          const websiteUrl = restaurant.website_url ?? details?.website_url;
          const menuUrl = details?.menu_url;
          const hasLinks = websiteUrl || menuUrl;
          const insights = details?.insights ?? null;

          return (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              {detailsLoading ? (
                <InsightsLoadingSkeleton />
              ) : insights ? (
                <InsightsPanel insights={insights} />
              ) : null}

              {hasLinks ? (
                <div className="flex gap-3">
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={linkClasses}
                    >
                      <WebsiteIcon />
                      Website
                    </a>
                  )}
                  {menuUrl && (
                    <a
                      href={menuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={linkClasses}
                    >
                      <MenuIcon />
                      Menu
                    </a>
                  )}
                </div>
              ) : !detailsLoading && !insights ? (
                <p className="text-xs text-gray-400">
                  No additional info available for this restaurant.
                </p>
              ) : null}
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
