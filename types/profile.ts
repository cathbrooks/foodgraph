import { z } from "zod";

export const CuisineSchema = z.enum([
  "american",
  "chinese",
  "indian",
  "italian",
  "japanese",
  "korean",
  "mexican",
  "thai",
  "vietnamese",
  "mediterranean",
  "french",
  "caribbean",
  "middle_eastern",
  "african",
  "other",
]);

export type Cuisine = z.infer<typeof CuisineSchema>;

export const DietaryRestrictionSchema = z.enum([
  "vegetarian",
  "vegan",
  "gluten_free",
  "halal",
  "kosher",
  "dairy_free",
  "nut_free",
  "none",
]);

export type DietaryRestriction = z.infer<typeof DietaryRestrictionSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(100).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const DistanceUnitSchema = z.enum(["km", "mi"]);

export type DistanceUnit = z.infer<typeof DistanceUnitSchema>;

export const UserPreferencesSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  cuisines: z.array(CuisineSchema),
  dietary_restrictions: z.array(DietaryRestrictionSchema),
  travel_radius_km: z.number().min(0.5).max(50).default(5),
  distance_unit: DistanceUnitSchema.default("km"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UpdatePreferencesSchema = z.object({
  cuisines: z.array(CuisineSchema).optional(),
  dietary_restrictions: z.array(DietaryRestrictionSchema).optional(),
  travel_radius_km: z.number().min(0.5).max(50).optional(),
  distance_unit: DistanceUnitSchema.optional(),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
