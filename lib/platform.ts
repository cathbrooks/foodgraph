import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export type Platform = "ios" | "android" | "web";

export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}
