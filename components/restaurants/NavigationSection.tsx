"use client";

import { openNavigation, staticMapUrl } from "@/lib/navigation";
import type { Location } from "@/types/restaurant";

interface NavigationSectionProps {
  location: Location;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
}

const NavigateIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function NavigationSection({
  location,
  googlePlaceId,
}: NavigationSectionProps) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div className="space-y-2">
      {mapsKey && (
        <img
          src={staticMapUrl(location.lat, location.lng, mapsKey)}
          alt="Restaurant location"
          className="w-full h-[160px] object-cover rounded-md"
          loading="lazy"
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          openNavigation(location.lat, location.lng, googlePlaceId);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-black hover:bg-gray-800 px-3 py-1.5 rounded-md transition-colors"
      >
        <NavigateIcon />
        Get Directions
      </button>
    </div>
  );
}
