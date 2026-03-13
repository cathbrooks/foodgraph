import type { RecommendationState } from "../state";
import { selectWildcard as pickWildcard } from "@/lib/wildcard/wildcardEngine";

export async function selectWildcard(
  state: RecommendationState
): Promise<Partial<RecommendationState>> {
  const wildcard = pickWildcard(
    state.filtered,
    state.scored.map((s) => s.restaurant),
    state.preferences
  );

  return { wildcard: wildcard ?? null };
}
