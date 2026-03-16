import { Annotation } from "@langchain/langgraph";
import type { BudgetSlot } from "@/types/budget";
import type { UserPreferences } from "@/types/profile";
import type { Restaurant, Location } from "@/types/restaurant";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PersonalizationHints } from "@/lib/personalization/personalizationEngine";
import type {
  ChatResponse,
  BudgetChoice,
  RecommendationContext,
  SessionState,
  RestaurantDetails,
} from "@/types/chat";

export type IntentType =
  | "recommend"
  | "refine"
  | "ask_detail"
  | "general"
  | "feedback"
  | "followup"
  | "unknown";

export interface IntentConstraints {
  cuisineFilter?: string;
  priceCeiling?: number;
  priceFloor?: number;
  requestedWildcard?: boolean;
  dietaryFilter?: string;
  targetRestaurant?: string;
  searchQuery?: string;
}

export interface Intent {
  type: IntentType;
  constraints: IntentConstraints;
}

export const RecommendationAnnotation = Annotation.Root({
  userId: Annotation<string>,
  userMessage: Annotation<string>,
  location: Annotation<Location>,
  includeWildcard: Annotation<boolean>,

  intent: Annotation<Intent | null>,

  budgetChoice: Annotation<BudgetChoice>,
  customBudgetCeiling: Annotation<number | null>,
  timezone: Annotation<string | undefined>,

  chatHistory: Annotation<Array<{ role: string; content: string }>>,
  lastRecommendations: Annotation<RecommendationContext[]>,

  sessionState: Annotation<SessionState>,

  slot: Annotation<BudgetSlot | null>,
  preferences: Annotation<UserPreferences | null>,
  personalization: Annotation<PersonalizationHints | null>,
  radiusKm: Annotation<number>,

  candidates: Annotation<Restaurant[]>,
  filtered: Annotation<Restaurant[]>,
  scored: Annotation<ScoredRecommendation[]>,
  wildcard: Annotation<ScoredRecommendation | null>,

  lookedUpDetails: Annotation<RestaurantDetails | null>,

  response: Annotation<ChatResponse | null>,

  earlyExitReason: Annotation<string | null>,

  timings: Annotation<Record<string, number>>,
});

export type RecommendationState = typeof RecommendationAnnotation.State;
