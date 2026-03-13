import { Geolocation } from "@capacitor/geolocation";
import type { Location } from "@/types/restaurant";
import { isNative } from "./platform";

export interface GeolocationResult {
  location: Location;
}

/**
 * Gets the current position using Capacitor Geolocation on native,
 * falling back to the browser Geolocation API on web.
 */
export async function getCurrentPosition(): Promise<GeolocationResult> {
  if (isNative()) {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") {
      await Geolocation.requestPermissions();
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });

    return {
      location: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      },
    };
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
