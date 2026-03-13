"use client";

import { useState, useCallback, useEffect } from "react";
import type { Location } from "@/types/restaurant";
import { getCurrentPosition } from "@/lib/geolocation";

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

interface UseLocationReturn {
  location: Location | null;
  status: LocationStatus;
  error: string | null;
  requestLocation: () => void;
}

const LOCATION_KEY = "foodclaw_last_location";
const CACHE_TTL_MS = 60_000;

interface CachedLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

function loadCached(): Location | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed: CachedLocation = JSON.parse(raw);
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      typeof parsed.timestamp === "number" &&
      Date.now() - parsed.timestamp < CACHE_TTL_MS
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
    sessionStorage.removeItem(LOCATION_KEY);
  } catch {
    // ignore
  }
  return null;
}

function saveCache(loc: Location) {
  try {
    const entry: CachedLocation = { ...loc, timestamp: Date.now() };
    sessionStorage.setItem(LOCATION_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<Location | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadCached();
    if (cached) {
      setLocation(cached);
      setStatus("granted");
    }
  }, []);

  const requestLocation = useCallback(() => {
    setStatus("requesting");
    setError(null);

    getCurrentPosition()
      .then((result) => {
        setLocation(result.location);
        setStatus("granted");
        saveCache(result.location);
      })
      .catch((err: unknown) => {
        const geoErr = err as { code?: number; PERMISSION_DENIED?: number };
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setStatus("denied");
          setError(
            "Location access was denied. Please enable it in your device settings."
          );
        } else {
          setStatus("unavailable");
          setError(
            "Could not determine your location. Please check your device's location services and try again."
          );
        }
      });
  }, []);

  return { location, status, error, requestLocation };
}
