import { z } from "zod";
import { RestaurantSchema } from "./restaurant";

export const ScoreBreakdownSchema = z.object({
  budget_fit: z.number(),
  cuisine_match: z.number(),
  distance: z.number(),
  rating: z.number(),
  personalization: z.number(),
  total: z.number(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const ScoredRecommendationSchema = z.object({
  restaurant: RestaurantSchema,
  score: ScoreBreakdownSchema,
  explanation: z.string().nullable(),
  is_wildcard: z.boolean().default(false),
});

export type ScoredRecommendation = z.infer<typeof ScoredRecommendationSchema>;

export const RecommendationEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  slot_id: z.string().uuid().nullable(),
  location_lat: z.number(),
  location_lng: z.number(),
  results: z.array(ScoredRecommendationSchema),
  candidate_count: z.number().int(),
  filters_applied: z.record(z.unknown()),
  created_at: z.string().datetime(),
});

export type RecommendationEvent = z.infer<typeof RecommendationEventSchema>;
