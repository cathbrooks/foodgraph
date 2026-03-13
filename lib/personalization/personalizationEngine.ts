import type { UserAction } from "@/types/action";
import { createClient } from "@/lib/supabase/server";

export interface PersonalizationHints {
  preferred_cuisines: string[];
  avg_selected_price: number | null;
  wildcard_acceptance_rate: number | null;
}

const EMPTY_HINTS: PersonalizationHints = {
  preferred_cuisines: [],
  avg_selected_price: null,
  wildcard_acceptance_rate: null,
};

export async function getPersonalizationHints(
  userId: string
): Promise<PersonalizationHints> {
  try {
    const supabase = await createClient();

    const { data: actions } = await supabase
      .from("user_actions")
      .select("action_type, restaurant_place_id, metadata, recommendation_event_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!actions || actions.length === 0) return EMPTY_HINTS;

    const { data: events } = await supabase
      .from("recommendation_events")
      .select("id, results")
      .in(
        "id",
        [...new Set(actions.map((a) => a.recommendation_event_id))]
      );

    const eventMap = new Map<string, Record<string, unknown>[]>();
    if (events) {
      for (const ev of events) {
        eventMap.set(ev.id, (ev.results ?? []) as Record<string, unknown>[]);
      }
    }

    return deriveHintsFromActions(actions as UserAction[], eventMap);
  } catch {
    return EMPTY_HINTS;
  }
}

export function deriveHintsFromActions(
  actions: UserAction[],
  eventResultsMap?: Map<string, Record<string, unknown>[]>
): PersonalizationHints {
  const cuisineCounts = new Map<string, number>();
  const selectedPrices: number[] = [];
  let wildcardRequests = 0;
  let wildcardSelects = 0;

  for (const action of actions) {
    if (action.action_type === "wildcard_request") {
      wildcardRequests++;
      continue;
    }
    if (action.action_type === "wildcard_select") {
      wildcardSelects++;
    }

    if (
      (action.action_type === "select" || action.action_type === "wildcard_select") &&
      action.restaurant_place_id &&
      eventResultsMap
    ) {
      const results = eventResultsMap.get(action.recommendation_event_id) ?? [];
      const matched = results.find(
        (r) => (r as Record<string, unknown>).place_id === action.restaurant_place_id
      ) as Record<string, unknown> | undefined;

      if (matched) {
        const score = matched.score as Record<string, unknown> | undefined;
        if (score && typeof score.budget_fit === "number" && matched.name) {
          // Use cuisines from restaurant data if available in the stored result
        }
      }
    }

    if (
      action.action_type === "select" &&
      action.metadata &&
      typeof action.metadata === "object"
    ) {
      const meta = action.metadata as Record<string, unknown>;
      if (Array.isArray(meta.cuisines)) {
        for (const c of meta.cuisines as string[]) {
          cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1);
        }
      }
      if (typeof meta.avg_price === "number") {
        selectedPrices.push(meta.avg_price);
      }
    }
  }

  const preferred_cuisines = [...cuisineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  const avg_selected_price =
    selectedPrices.length > 0
      ? Math.round(
          (selectedPrices.reduce((a, b) => a + b, 0) / selectedPrices.length) * 100
        ) / 100
      : null;

  const wildcard_acceptance_rate =
    wildcardRequests > 0
      ? Math.round((wildcardSelects / wildcardRequests) * 100) / 100
      : null;

  return {
    preferred_cuisines,
    avg_selected_price,
    wildcard_acceptance_rate,
  };
}
