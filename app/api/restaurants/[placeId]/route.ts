import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaceDetails } from "@/lib/restaurants/restaurantProvider";
import { fetchRestaurantInsights } from "@/lib/ai/searchPreview";
import { jsonError } from "@/lib/utils/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const { placeId } = await params;

  if (!placeId || placeId.length < 5) {
    return jsonError("Invalid place ID");
  }

  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const address = url.searchParams.get("address") ?? "";

  try {
    const [details, insights] = await Promise.all([
      getPlaceDetails(placeId),
      name
        ? fetchRestaurantInsights(name, address).catch(() => null)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...details, insights });
  } catch (err) {
    console.error("Restaurant details fetch failed:", err);
    return jsonError(
      "Failed to fetch restaurant details. Please try again.",
      500
    );
  }
}
