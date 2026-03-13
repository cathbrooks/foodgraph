import { isNative } from "./platform";

export function apiBase(): string {
  if (isNative()) {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://localhost:3000";
  }
  return "";
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`;
}
