import { z } from "zod";
import { LocationSchema, GoogleReviewSchema } from "./restaurant";
import { ScoredRecommendationSchema } from "./recommendation";

export const ChatMessageRoleSchema = z.enum(["user", "assistant"]);

export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: ChatMessageRoleSchema,
  content: z.string(),
  recommendations: z.array(ScoredRecommendationSchema).nullable(),
  created_at: z.string().datetime(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const BudgetChoiceSchema = z.enum(["slot", "custom", "none"]);

export type BudgetChoice = z.infer<typeof BudgetChoiceSchema>;

export const ChatHistoryEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const RecommendationContextSchema = z.object({
  restaurant_name: z.string(),
  place_id: z.string(),
  cuisine: z.string().nullable(),
  avg_price: z.number().nullable(),
  rating: z.number().nullable(),
  distance_km: z.number().nullable(),
  is_wildcard: z.boolean(),
  explanation: z.string().nullable(),
});

export type RecommendationContext = z.infer<typeof RecommendationContextSchema>;

export const RestaurantDetailsSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  website_url: z.string().nullable(),
  google_maps_url: z.string().nullable(),
  google_place_id: z.string().nullable(),
  location: LocationSchema.nullable(),
  editorial_summary: z.string().nullable(),
  reviews: z.array(GoogleReviewSchema),
  opening_hours: z.array(z.string()).nullable(),
  is_open_now: z.boolean().nullable(),
  dine_in: z.boolean().nullable(),
  delivery: z.boolean().nullable(),
  takeout: z.boolean().nullable(),
  reservable: z.boolean().nullable(),
  serves_vegetarian: z.boolean().nullable(),
  photos: z.array(z.string()),
  known_for: z.array(z.string()),
});

export type RestaurantDetails = z.infer<typeof RestaurantDetailsSchema>;

export const SessionStateSchema = z.object({
  restaurants: z.array(RecommendationContextSchema).default([]),
  restaurantDetails: z.record(z.string(), RestaurantDetailsSchema).default({}),
  selectedRestaurant: RecommendationContextSchema.nullable().default(null),
  filters: z.object({
    cuisineFilter: z.string().nullable().default(null),
    dietaryFilter: z.string().nullable().default(null),
    priceCeiling: z.number().nullable().default(null),
    budgetChoice: BudgetChoiceSchema.default("slot"),
  }).default({}),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

export const EMPTY_SESSION_STATE: SessionState = {
  restaurants: [],
  restaurantDetails: {},
  selectedRestaurant: null,
  filters: {
    cuisineFilter: null,
    dietaryFilter: null,
    priceCeiling: null,
    budgetChoice: "slot",
  },
};

export const StateUpdatesSchema = z.object({
  restaurants: z.array(RecommendationContextSchema).optional(),
  restaurantDetails: z.record(z.string(), RestaurantDetailsSchema).optional(),
  selectedRestaurant: RecommendationContextSchema.nullable().optional(),
}).optional();

export type StateUpdates = z.infer<typeof StateUpdatesSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(500),
  location: LocationSchema,
  include_wildcard: z.boolean().default(false),
  budget_choice: BudgetChoiceSchema.default("slot"),
  custom_budget_ceiling: z.number().min(1).nullable().default(null),
  history: z.array(ChatHistoryEntrySchema).max(6).default([]),
  last_recommendations: z.array(RecommendationContextSchema).max(10).default([]),
  session_state: SessionStateSchema.optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  message: ChatMessageSchema,
  recommendation_event_id: z.string().uuid().nullable(),
  state_updates: StateUpdatesSchema,
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
