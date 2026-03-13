import type { PlaceDetails } from "@/types/restaurant";
import { createClient } from "@/lib/supabase/server";

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function getGoogleDetailsCached(
  fsqPlaceId: string
): Promise<PlaceDetails | null> {
  try {
    const supabase = await createClient();
    const { data: cached } = await supabase
      .from("google_place_details_cache")
      .select("data, expires_at")
      .eq("fsq_place_id", fsqPlaceId)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return cached.data as PlaceDetails;
    }
  } catch {
    // cache miss or table doesn't exist yet
  }

  return null;
}

export async function putGoogleDetailsCache(
  fsqPlaceId: string,
  googlePlaceId: string,
  details: PlaceDetails
): Promise<void> {
  try {
    const supabase = await createClient();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    await supabase.from("google_place_details_cache").upsert(
      {
        google_place_id: googlePlaceId,
        fsq_place_id: fsqPlaceId,
        data: details,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "google_place_id" }
    );
  } catch {
    // cache write failure is non-critical
  }
}
