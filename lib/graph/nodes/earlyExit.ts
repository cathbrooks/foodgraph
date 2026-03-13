import type { RecommendationState } from "../state";
import type { ChatMessage, ChatResponse } from "@/types/chat";

const EXIT_MESSAGES: Record<string, string> = {
  UNKNOWN_INTENT:
    "Hmm, I'm not sure how to help with that. I'm best at finding restaurants — try asking me for a recommendation like \"I'm craving sushi\" or \"find me something cheap nearby\"!",
  NO_ACTIVE_BUDGET_SLOT:
    "You don't have an active budget slot right now. Set one up in Profile so I can find restaurants that fit your budget.",
  NO_NEARBY_RESTAURANTS:
    "I couldn't find any restaurants near your location. Try increasing your travel radius in Settings.",
  INTERNAL_ERROR:
    "Something went wrong while getting recommendations. Please try again.",
};

export async function earlyExit(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'earlyExit.ts:entry',message:'earlyExit entered',data:{earlyExitReason:state.earlyExitReason,budgetChoice:state.budgetChoice,hasSlot:!!state.slot},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  const reason = state.earlyExitReason ?? "INTERNAL_ERROR";
  const usingBudgetSlot = state.budgetChoice === "slot";

  let content = EXIT_MESSAGES[reason] ?? EXIT_MESSAGES.INTERNAL_ERROR;

  if (reason === "NO_MATCHING_RESTAURANTS") {
    if (usingBudgetSlot && state.slot) {
      content = `No restaurants match your current budget slot "${state.slot.label}" ($${state.slot.min_budget}–$${state.slot.max_budget}). Try adjusting your budget or preferences.`;
    } else if (state.budgetChoice === "custom" && state.customBudgetCeiling) {
      content = `I couldn't find restaurants under $${state.customBudgetCeiling} that match your criteria. Try a higher budget or different filters.`;
    } else {
      content = "I couldn't find restaurants matching your criteria nearby. Try broadening your search or adjusting your preferences.";
    }
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    recommendations: null,
    created_at: new Date().toISOString(),
  };

  const response: ChatResponse = {
    message,
    recommendation_event_id: null,
    state_updates: undefined,
  };

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'earlyExit.ts:exit',message:'earlyExit returning response',data:{hasResponse:!!response,messageContent:message.content?.substring(0,80)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  return { response };
}
