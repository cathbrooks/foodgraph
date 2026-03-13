import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails, PriceLevel } from "@/types/restaurant";
import type { GoogleReview } from "@/types/restaurant";
import { Card, Spinner } from "@/components/ui";
import { NavigationSection } from "./NavigationSection";

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

function DetailsLoadingSkeleton() {
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
      <div className="h-[100px] bg-gray-100 rounded mt-2" />
    </div>
  );
}

function ServiceTags({ details }: { details: PlaceDetails }) {
  const tags: string[] = [];
  if (details.dine_in) tags.push("Dine-in");
  if (details.delivery) tags.push("Delivery");
  if (details.takeout) tags.push("Takeout");
  if (details.reservable) tags.push("Reservable");
  if (details.serves_vegetarian) tags.push("Vegetarian options");

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function KnownForSection({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Known For
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function OpeningHours({ details }: { details: PlaceDetails }) {
  if (!details.opening_hours || details.opening_hours.length === 0) return null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = details.opening_hours.find((h) =>
    h.toLowerCase().startsWith(today.toLowerCase())
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {details.is_open_now != null && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              details.is_open_now
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {details.is_open_now ? "Open now" : "Closed"}
          </span>
        )}
        {todayHours && (
          <span className="text-xs text-gray-500">{todayHours}</span>
        )}
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-xs text-amber-500">
      {"★".repeat(Math.round(rating))}
      {"☆".repeat(5 - Math.round(rating))}
    </span>
  );
}

function ReviewCard({ review }: { review: GoogleReview }) {
  return (
    <div className="space-y-1 py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">{review.author}</span>
        <span className="text-xs text-gray-400">{review.relative_time}</span>
      </div>
      <StarRating rating={review.rating} />
      {review.text && (
        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
          {review.text}
        </p>
      )}
    </div>
  );
}

function ReviewsSection({
  reviews,
  googleMapsUrl,
}: {
  reviews: GoogleReview[];
  googleMapsUrl?: string | null;
}) {
  if (reviews.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Reviews
        </h4>
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            See all on Google &rarr;
          </a>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {reviews.slice(0, 2).map((review, i) => (
          <ReviewCard key={`${review.author}-${i}`} review={review} />
        ))}
      </div>
    </div>
  );
}

const PRICE_RANGES: Record<string, string> = {
  $: "$5 – $15",
  $$: "$15 – $30",
  $$$: "$30 – $60",
  $$$$: "$60+",
};

function PriceEstimate({
  priceLevel,
  avgPrice,
  googlePriceLevel,
}: {
  priceLevel: PriceLevel | null;
  avgPrice: number | null;
  googlePriceLevel?: string | null;
}) {
  const displayLevel = googlePriceLevel ?? priceLevel;
  if (!displayLevel && avgPrice == null) return null;

  const rangeKey = displayLevel as keyof typeof PRICE_RANGES;

  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
      <span className="text-sm">💰</span>
      <div className="text-sm text-emerald-800">
        <span className="font-medium">Estimated cost: </span>
        {avgPrice != null ? (
          <span>~${avgPrice} per person</span>
        ) : rangeKey && PRICE_RANGES[rangeKey] ? (
          <span>{PRICE_RANGES[rangeKey]} per person</span>
        ) : null}
        {displayLevel && <span className="text-emerald-600 ml-1.5">({displayLevel})</span>}
      </div>
    </div>
  );
}

function DetailsPanel({ details }: { details: PlaceDetails }) {
  return (
    <div className="space-y-3">
      {details.editorial_summary && (
        <p className="text-sm text-gray-700 leading-relaxed">
          {details.editorial_summary}
        </p>
      )}

      <KnownForSection items={details.known_for} />
      <ServiceTags details={details} />
      <OpeningHours details={details} />
      <ReviewsSection reviews={details.reviews} googleMapsUrl={details.google_maps_url} />

      {details.location && (
        <NavigationSection
          location={details.location}
          googlePlaceId={details.google_place_id}
          googleMapsUrl={details.google_maps_url}
        />
      )}
    </div>
  );
}

const linkClasses =
  "inline-flex items-center gap-1.5 text-xs font-medium text-black bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors";

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

          return (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              <PriceEstimate
                priceLevel={restaurant.price_level}
                avgPrice={restaurant.avg_price_per_person}
                googlePriceLevel={details?.price_level}
              />
              {detailsLoading ? (
                <DetailsLoadingSkeleton />
              ) : details ? (
                <DetailsPanel details={details} />
              ) : null}

              {websiteUrl && !detailsLoading && (
                <div className="flex gap-3">
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
                </div>
              )}

              {!detailsLoading && !details && (
                <p className="text-xs text-gray-400">
                  No additional info available for this restaurant.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
