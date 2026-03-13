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

export const RestaurantCacheEntrySchema = z.object({
  id: z.string().uuid(),
  place_id: z.string(),
  data: RestaurantSchema,
  fetched_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type RestaurantCacheEntry = z.infer<typeof RestaurantCacheEntrySchema>;
