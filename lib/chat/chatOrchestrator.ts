import type { ChatRequest, ChatResponse, SessionState } from "@/types/chat";
import { EMPTY_SESSION_STATE as defaultSessionState } from "@/types/chat";
import { recommendationGraph } from "@/lib/graph/recommendationGraph";
import type { RecommendationState } from "@/lib/graph/state";

export async function handleChatRequest(
  userId: string,
  request: ChatRequest
): Promise<ChatResponse> {
  const sessionState: SessionState = request.session_state ?? { ...defaultSessionState };

  const initialState: Partial<RecommendationState> = {
    userId,
    userMessage: request.message,
    location: request.location,
    includeWildcard: request.include_wildcard,
    budgetChoice: request.budget_choice,
    customBudgetCeiling: request.custom_budget_ceiling ?? null,
    chatHistory: request.history ?? [],
    lastRecommendations: request.last_recommendations ?? [],
    sessionState,
    intent: null,
    slot: null,
    preferences: null,
    personalization: null,
    radiusKm: 5,
    candidates: [],
    filtered: [],
    scored: [],
    wildcard: null,
    lookedUpDetails: null,
    response: null,
    earlyExitReason: null,
    timings: {},
  };

  const finalState = await recommendationGraph.invoke(initialState);

  return finalState.response!;
}
