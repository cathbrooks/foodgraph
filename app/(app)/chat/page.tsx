"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "@/lib/hooks/useLocation";
import { useNewChatListener } from "@/lib/hooks/useNewChat";
import { trackAction } from "@/lib/hooks/useTrackAction";
import { useChatStore } from "@/lib/stores/chatStore";
import type { ChatMessage, BudgetChoice, RecommendationContext, RestaurantDetails } from "@/types/chat";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails } from "@/types/restaurant";
import type { DistanceUnit } from "@/types/profile";
import type { LayoutProps } from "@/components/layouts/types";
import { Layout4 } from "@/components/layouts";

const FIXED_CHIP = {
  label: "Find me something within my budget",
  budgetChoice: "slot" as BudgetChoice,
  skipConfirmation: true,
};

const DYNAMIC_CHIP_TEMPLATES = [
  { budgetChoice: null as BudgetChoice | null, skipConfirmation: false },
  { budgetChoice: null as BudgetChoice | null, skipConfirmation: false },
  { budgetChoice: "none" as BudgetChoice, skipConfirmation: true, wildcard: true },
  { budgetChoice: null as BudgetChoice | null, skipConfirmation: false },
  { budgetChoice: "none" as BudgetChoice, skipConfirmation: true },
];

const DEFAULT_DYNAMIC_LABELS = [
  "I'm craving Thai food",
  "Somewhere vegetarian-friendly",
  "Surprise me \u2014 anything goes!",
  "What's good for a group dinner?",
  "I'm feeling fancy",
];

const ActiveLayout = Layout4;

export default function ChatPage() {
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const appendToLastMessage = useChatStore((s) => s.appendToLastMessage);
  const sessionState = useChatStore((s) => s.sessionState);
  const mergeStateUpdates = useChatStore((s) => s.mergeStateUpdates);
  const placeDetails = useChatStore((s) => s.placeDetails);
  const setPlaceDetails = useChatStore((s) => s.setPlaceDetails);
  const selectedPlaceId = useChatStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useChatStore((s) => s.setSelectedPlaceId);
  const confirmedBudget = useChatStore((s) => s.confirmedBudget);
  const dynamicLabels = useChatStore((s) => s.dynamicLabels);
  const setDynamicLabels = useChatStore((s) => s.setDynamicLabels);
  const greeting = useChatStore((s) => s.greeting);
  const setGreeting = useChatStore((s) => s.setGreeting);
  const setSessionState = useChatStore((s) => s.setSessionState);
  const resetStore = useChatStore((s) => s.reset);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("km");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { location, status, error: locError, requestLocation } = useLocation();

  const resetChat = useCallback(() => {
    resetStore();
    setInput("");
    setLoading(false);
    setLastEventId(null);
    setDetailsLoading(null);
    setExpandedMessages(new Set());

    fetch("/api/chat/welcome-chips", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.labels?.length === DEFAULT_DYNAMIC_LABELS.length) {
          setDynamicLabels(data.labels);
        }
        if (data?.greeting) {
          setGreeting(data.greeting);
        }
      })
      .catch(() => {});
  }, [resetStore, setDynamicLabels, setGreeting]);

  useNewChatListener(resetChat);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (messages.length > 0) return;
    let cancelled = false;
    fetch("/api/chat/welcome-chips", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.labels?.length === DEFAULT_DYNAMIC_LABELS.length) {
          setDynamicLabels(data.labels);
        }
        if (!cancelled && data?.greeting) {
          setGreeting(data.greeting);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.preferences?.distance_unit) {
          setDistanceUnit(data.preferences.distance_unit);
        }
      })
      .catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  function buildHistory(): Array<{ role: "user" | "assistant"; content: string }> {
    return messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  }

  function addAssistantMessage(content: string) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      recommendations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }

  function addUserMessage(content: string) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      recommendations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }

  async function fetchRecommendations(
    message: string,
    budgetChoice: BudgetChoice,
    customCeiling: number | null = null,
    includeWildcard = false
  ) {
    setLoading(true);
    scrollToBottom();

    // Add placeholder for the streaming assistant message
    const placeholderId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        recommendations: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          location,
          include_wildcard: includeWildcard,
          budget_choice: budgetChoice,
          custom_budget_ceiling: customCeiling,
          history: buildHistory(),
          session_state: sessionState,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; delta?: string; message?: ChatMessage; recommendation_event_id?: string | null; state_updates?: unknown; message_str?: string };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "text" && event.delta) {
            // Hide the loading skeleton as soon as text starts streaming
            if (loading) setLoading(false);
            appendToLastMessage(event.delta);
            scrollToBottom();
          } else if (event.type === "done" && event.message) {
            // Replace placeholder with final message (includes recommendations)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...event.message!, id: placeholderId } : m
              )
            );
            if (event.recommendation_event_id) {
              setLastEventId(event.recommendation_event_id);
            }
            if (event.message.recommendations?.length) {
              // session state updated via state_updates below
            }
            if (event.state_updates) {
              mergeStateUpdates(event.state_updates as Parameters<typeof mergeStateUpdates>[0]);
            }
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? { ...m, content: "Something went wrong. Please try again." }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content:
                  err instanceof Error ? err.message : "Something went wrong. Please try again.",
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    if (!location) {
      if (status === "denied") {
        addAssistantMessage("I need your location to find nearby restaurants. Please enable location access in your browser settings and try again.");
        return;
      }
      if (status === "unavailable") {
        addAssistantMessage("I couldn't determine your location. Please check your device settings and try again.");
        return;
      }
      requestLocation();
      return;
    }

    setInput("");
    addUserMessage(text.trim());
    await fetchRecommendations(
      text.trim(),
      confirmedBudget?.choice ?? "slot",
      confirmedBudget?.customCeiling ?? null
    );
  }

  async function handleFindFood() {
    if (!location || loading) return;
    addUserMessage("Find me somewhere to eat right now in my budget.");
    await fetchRecommendations("Find me somewhere to eat right now in my budget", "slot");
  }

  async function handleWildcard() {
    if (!location || loading) return;
    trackAction(lastEventId, null, "wildcard_request");
    addUserMessage("Surprise me with a wildcard pick!");
    await fetchRecommendations("Give me a wildcard recommendation", "none", null, true);
  }

  function handleChipClick(chip: { label: string; budgetChoice: BudgetChoice | null; skipConfirmation: boolean }) {
    if (!location || loading) return;
    // Prefix custom budget into message so the agent sees it explicitly
    const budgetPrefix =
      chip.budgetChoice === "none"
        ? "[No budget limit] "
        : chip.budgetChoice === "slot"
        ? "[Use my budget slot] "
        : "";
    const messageText = budgetPrefix + chip.label;
    addUserMessage(chip.label);
    const isWildcard = "wildcard" in chip && (chip as Record<string, unknown>).wildcard === true;
    fetchRecommendations(
      messageText,
      chip.budgetChoice ?? confirmedBudget?.choice ?? "slot",
      chip.budgetChoice === null ? (confirmedBudget?.customCeiling ?? null) : null,
      isWildcard
    );
  }

  function handleCardClick(rec: ScoredRecommendation) {
    trackAction(lastEventId, rec.restaurant.place_id, "click");
  }

  async function handleCardSelect(rec: ScoredRecommendation) {
    const placeId = rec.restaurant.place_id;
    trackAction(lastEventId, placeId, rec.is_wildcard ? "wildcard_select" : "select");

    if (selectedPlaceId === placeId) {
      setSelectedPlaceId(null);
      setSessionState((prev) => ({ ...prev, selectedRestaurant: null }));
      return;
    }

    setSelectedPlaceId(placeId);

    const selectedCtx: RecommendationContext = {
      restaurant_name: rec.restaurant.name,
      place_id: rec.restaurant.place_id,
      cuisine: rec.restaurant.cuisines?.[0] ?? null,
      avg_price: rec.restaurant.avg_price_per_person ?? null,
      rating: rec.restaurant.rating ?? null,
      distance_km: rec.restaurant.distance_km ?? null,
      is_wildcard: rec.is_wildcard ?? false,
      explanation: rec.explanation ?? null,
    };
    setSessionState((prev) => ({ ...prev, selectedRestaurant: selectedCtx }));

    if (placeDetails[placeId]) return;

    setDetailsLoading(placeId);
    try {
      const qs = new URLSearchParams({
        name: rec.restaurant.name,
        address: rec.restaurant.address,
      });
      const res = await fetch(`/api/restaurants/${encodeURIComponent(placeId)}?${qs}`);
      if (res.ok) {
        const data: PlaceDetails = await res.json();
        setPlaceDetails((prev) => ({ ...prev, [placeId]: data }));

        const detailEntry: RestaurantDetails = {
          place_id: placeId,
          name: rec.restaurant.name,
          website_url: data.website_url,
          google_maps_url: data.google_maps_url,
          google_place_id: data.google_place_id,
          location: data.location,
          editorial_summary: data.editorial_summary,
          reviews: data.reviews,
          opening_hours: data.opening_hours,
          is_open_now: data.is_open_now,
          price_level: data.price_level,
          dine_in: data.dine_in,
          delivery: data.delivery,
          takeout: data.takeout,
          reservable: data.reservable,
          serves_vegetarian: data.serves_vegetarian,
          photos: data.photos,
          known_for: data.known_for,
        };
        setSessionState((prev) => ({
          ...prev,
          restaurantDetails: { ...prev.restaurantDetails, [placeId]: detailEntry },
        }));
      }
    } catch {
      // non-critical
    } finally {
      setDetailsLoading(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const locationReady = status === "granted" && !!location;
  const locationPending = status === "requesting";
  const locationFailed = status === "denied" || status === "unavailable";
  const hasStarted = messages.length > 0 || loading;

  const layoutProps: LayoutProps = {
    messages,
    input,
    setInput,
    loading,
    locationReady,
    locationPending,
    locationFailed,
    locError: locError ?? null,
    hasStarted,
    selectedPlaceId,
    placeDetails,
    detailsLoading,
    expandedMessages,
    setExpandedMessages,
    scrollRef,
    inputRef,
    scrollToBottom,
    handleSubmit,
    handleChipClick,
    handleFindFood,
    handleWildcard,
    handleCardClick,
    handleCardSelect,
    requestLocation,
    greeting,
    onNewChat: resetChat,
    welcomeChips: [
      FIXED_CHIP,
      ...DYNAMIC_CHIP_TEMPLATES.map((tpl, i) => ({ ...tpl, label: dynamicLabels[i] })),
    ],
    distanceUnit,
  };

  return (
    <ActiveLayout {...layoutProps} />
  );
}
