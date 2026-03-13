import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaceDetails } from "@/lib/restaurants/restaurantProvider";
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
    const details = await getPlaceDetails(placeId, name, address);
    return NextResponse.json(details);
  } catch (err) {
    console.error("Restaurant details fetch failed:", err);
    return jsonError(
      "Failed to fetch restaurant details. Please try again.",
      500
    );
  }
}
