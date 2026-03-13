import type { RecommendationState } from "../state";

export function afterInterpretIntent(
  state: RecommendationState
): "earlyExit" | "handleFollowup" | "lookupRestaurantDetails" | "resolveContext" {
  if (state.earlyExitReason) return "earlyExit";

  switch (state.intent?.type) {
    case "ask_detail":
      return "lookupRestaurantDetails";
    case "refine":
      return "resolveContext";
    case "followup":
    case "feedback":
    case "general":
      return "handleFollowup";
    case "unknown":
      return "earlyExit";
    default:
      return "resolveContext";
  }
}

export function shouldEarlyExit(
  state: RecommendationState
): "earlyExit" | "continue" {
  return state.earlyExitReason ? "earlyExit" : "continue";
}

export function afterFilterAndScore(
  state: RecommendationState
): "earlyExit" | "selectWildcard" | "generateExplanations" {
  if (state.earlyExitReason) return "earlyExit";
  return state.includeWildcard ? "selectWildcard" : "generateExplanations";
}
