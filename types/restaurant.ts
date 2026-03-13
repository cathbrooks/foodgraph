import { z } from "zod";

export const PriceLevelSchema = z.enum(["$", "$$", "$$$", "$$$$"]);

export type PriceLevel = z.infer<typeof PriceLevelSchema>;

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export type Location = z.infer<typeof LocationSchema>;

export const RestaurantSchema = z.object({
  id: z.string(),
  place_id: z.string(),
  name: z.string(),
  address: z.string(),
  location: LocationSchema,
  price_level: PriceLevelSchema.nullable(),
  avg_price_per_person: z.number().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  review_count: z.number().int().min(0).nullable(),
  cuisines: z.array(z.string()),
  dietary_tags: z.array(z.string()),
  is_open_now: z.boolean().nullable(),
  distance_km: z.number().nullable(),
  photo_url: z.string().url().nullable(),
  website_url: z.string().url().nullable().optional(),
  menu_url: z.string().url().nullable().optional(),
});

export type Restaurant = z.infer<typeof RestaurantSchema>;

export interface PlaceDetails {
  website_url: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  location: Location | null;
  editorial_summary: string | null;
  reviews: GoogleReview[];
  opening_hours: string[] | null;
  is_open_now: boolean | null;
  price_level: string | null;
  dine_in: boolean | null;
  delivery: boolean | null;
  takeout: boolean | null;
  reservable: boolean | null;
  serves_vegetarian: boolean | null;
  photos: string[];
  known_for: string[];
}

export const GoogleReviewSchema = z.object({
  author: z.string(),
  rating: z.number().min(1).max(5),
  text: z.string(),
  relative_time: z.string(),
});

export type GoogleReview = z.infer<typeof GoogleReviewSchema>;

export const RestaurantCacheEntrySchema = z.object({
  id: z.string().uuid(),
  place_id: z.string(),
  data: RestaurantSchema,
  fetched_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type RestaurantCacheEntry = z.infer<typeof RestaurantCacheEntrySchema>;
