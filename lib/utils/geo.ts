import type { Location } from "@/types/restaurant";
import type { DistanceUnit } from "@/types/profile";

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.60934;

/** Haversine distance between two coordinates in kilometres. */
export function distanceKm(a: Location, b: Location): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const value = unit === "mi" ? kmToMiles(km) : km;
  return `${value.toFixed(1)} ${unit}`;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
