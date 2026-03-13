"use client";

import type { UserActionType } from "@/types/action";

export function trackAction(
  eventId: string | null,
  placeId: string | null,
  actionType: UserActionType,
  metadata?: Record<string, unknown>
) {
  if (!eventId) return;

  fetch("/api/user-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendation_event_id: eventId,
      restaurant_place_id: placeId,
      action_type: actionType,
      metadata: metadata ?? null,
    }),
  }).catch(() => {
    // non-critical — don't block UI
  });
}
