import { getPlatform } from "./platform";

export function openNavigation(
  lat: number,
  lng: number,
  googlePlaceId?: string | null
) {
  const platform = getPlatform();

  if (platform === "ios") {
    window.open(
      `maps://maps.apple.com/?daddr=${lat},${lng}`,
      "_system"
    );
  } else if (platform === "android") {
    window.open(
      `geo:${lat},${lng}?q=${lat},${lng}`,
      "_system"
    );
  } else {
    const dest = googlePlaceId
      ? `&destination_place_id=${googlePlaceId}`
      : "";
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${dest}`,
      "_blank"
    );
  }
}

export function staticMapUrl(
  lat: number,
  lng: number,
  apiKey: string,
  width = 400,
  height = 200
): string {
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=15&size=${width}x${height}` +
    `&markers=color:red%7C${lat},${lng}` +
    `&key=${apiKey}`
  );
}
