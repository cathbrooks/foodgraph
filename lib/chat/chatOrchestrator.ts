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

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'chatOrchestrator.ts:before-invoke',message:'About to invoke graph',data:{budgetChoice:request.budget_choice,hasLocation:!!request.location},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  const finalState = await recommendationGraph.invoke(initialState);

  // #region agent log
  fetch('http://127.0.0.1:7918/ingest/c3a3bfcf-a94d-45d2-a9fc-846a986bdef8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e1907f'},body:JSON.stringify({sessionId:'e1907f',location:'chatOrchestrator.ts:after-invoke',message:'Graph completed',data:{hasResponse:!!finalState.response,earlyExitReason:finalState.earlyExitReason,responseIsNull:finalState.response===null,responseType:typeof finalState.response},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  return finalState.response!;
}
