"use client";

import { useState, useCallback, useEffect } from "react";
import type { Location } from "@/types/restaurant";

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
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(loc);
        setStatus("granted");
        saveCache(loc);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            setError(
              "Location access was denied. Please enable it in your browser settings."
            );
            break;
          case err.TIMEOUT:
          case err.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setError(
              "Could not determine your location. Please check your device's location services and try again."
            );
            break;
          default:
            setStatus("unavailable");
            setError("An unknown error occurred while fetching your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  return { location, status, error, requestLocation };
}
