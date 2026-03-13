"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "@/lib/hooks/useLocation";
import { useNewChatListener } from "@/lib/hooks/useNewChat";
import { trackAction } from "@/lib/hooks/useTrackAction";
import { useChatStore } from "@/lib/stores/chatStore";
import type { ChatMessage, BudgetChoice, RecommendationContext, RestaurantDetails } from "@/types/chat";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails } from "@/types/restaurant";
import type { LayoutProps } from "@/components/layouts/types";
import { Layout4 } from "@/components/layouts";

interface PendingBudgetConfirmation {
  userMessage: string;
  assistantPrompt: string;
  includeWildcard: boolean;
}

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

const BUDGET_CHIPS = [
  { label: "Under $15", value: 15 },
  { label: "Under $25", value: 25 },
  { label: "Under $50", value: 50 },
  { label: "Under $75", value: 75 },
] as const;

const ActiveLayout = Layout4;

export default function ChatPage() {
  const messages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const lastRecommendations = useChatStore((s) => s.lastRecommendations);
  const setLastRecommendations = useChatStore((s) => s.setLastRecommendations);
  const sessionState = useChatStore((s) => s.sessionState);
  const setSessionState = useChatStore((s) => s.setSessionState);
  const mergeStateUpdates = useChatStore((s) => s.mergeStateUpdates);
  const placeDetails = useChatStore((s) => s.placeDetails);
  const setPlaceDetails = useChatStore((s) => s.setPlaceDetails);
  const selectedPlaceId = useChatStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useChatStore((s) => s.setSelectedPlaceId);
  const confirmedBudget = useChatStore((s) => s.confirmedBudget);
  const setConfirmedBudget = useChatStore((s) => s.setConfirmedBudget);
  const dynamicLabels = useChatStore((s) => s.dynamicLabels);
  const setDynamicLabels = useChatStore((s) => s.setDynamicLabels);
  const greeting = useChatStore((s) => s.greeting);
  const setGreeting = useChatStore((s) => s.setGreeting);
  const resetStore = useChatStore((s) => s.reset);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingBudgetConfirmation | null>(null);
  const [showBudgetChips, setShowBudgetChips] = useState(false);
  const [budgetPromptLoading, setBudgetPromptLoading] = useState(false);

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
    setPendingConfirmation(null);
    setShowBudgetChips(false);
    setBudgetPromptLoading(false);

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

  function extractRecommendationContext(recs: ScoredRecommendation[]): RecommendationContext[] {
    return recs.map((r) => ({
      restaurant_name: r.restaurant.name,
      place_id: r.restaurant.place_id,
      cuisine: r.restaurant.cuisines?.[0] ?? null,
      avg_price: r.restaurant.avg_price_per_person ?? null,
      rating: r.restaurant.rating ?? null,
      distance_km: r.restaurant.distance_km ?? null,
      is_wildcard: r.is_wildcard ?? false,
      explanation: r.explanation ?? null,
    }));
  }

  async function fetchRecommendations(
    message: string,
    budgetChoice: BudgetChoice,
    customCeiling: number | null = null,
    includeWildcard = false
  ) {
    setLoading(true);
    scrollToBottom();

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
          last_recommendations: lastRecommendations,
          session_state: sessionState,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      if (data.recommendation_event_id) {
        setLastEventId(data.recommendation_event_id);
      }
      if (data.message.recommendations?.length) {
        setLastRecommendations(extractRecommendationContext(data.message.recommendations));
      }
      if (data.state_updates) {
        mergeStateUpdates(data.state_updates);
      }
    } catch (err) {
      addAssistantMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }

  async function startBudgetConfirmation(text: string, includeWildcard = false) {
    if (!location) return;

    addUserMessage(text);
    setBudgetPromptLoading(true);
    scrollToBottom();

    let promptText: string;
    try {
      const res = await fetch("/api/chat/budget-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_message: text }),
      });
      const data = await res.json();
      promptText = data.message;
    } catch {
      promptText = "Sounds good! Do you want me to stick to your usual budget, or are you open to anything?";
    }

    addAssistantMessage(promptText);
    setBudgetPromptLoading(false);
    setPendingConfirmation({
      userMessage: text,
      assistantPrompt: promptText,
      includeWildcard,
    });
    scrollToBottom();
  }

  async function handleBudgetSelection(choice: BudgetChoice, customCeiling: number | null = null) {
    if (!pendingConfirmation) return;

    const choiceLabels: Record<BudgetChoice, string> = {
      slot: "Use my current budget",
      custom: customCeiling ? `Under $${customCeiling}` : "Set a custom budget",
      none: "Budget doesn't matter",
    };

    addUserMessage(choiceLabels[choice]);
    setConfirmedBudget({ choice, customCeiling });
    const { userMessage, includeWildcard } = pendingConfirmation;
    setPendingConfirmation(null);
    setShowBudgetChips(false);

    await fetchRecommendations(userMessage, choice, customCeiling, includeWildcard);
  }

  async function sendDirectToChat(text: string) {
    addUserMessage(text);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          location,
          include_wildcard: false,
          budget_choice: "none" as BudgetChoice,
          custom_budget_ceiling: null,
          history: buildHistory(),
          last_recommendations: lastRecommendations,
          session_state: sessionState,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      if (data.state_updates) {
        mergeStateUpdates(data.state_updates);
      }
    } catch (err) {
      addAssistantMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
      scrollToBottom();
      inputRef.current?.focus();
    }
  }

  async function classifyIntent(text: string): Promise<string> {
    try {
      const restaurantNames = sessionState.restaurants.map((r) => r.restaurant_name);
      const res = await fetch("/api/chat/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_message: text,
          history: buildHistory(),
          restaurant_names: restaurantNames,
        }),
      });
      if (!res.ok) return "recommend";
      const data = await res.json();
      return data.type ?? "recommend";
    } catch {
      return "recommend";
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading || budgetPromptLoading) return;

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

    if (pendingConfirmation && showBudgetChips) {
      const match = text.trim().match(/^\$?(\d+)/);
      if (match) {
        const amount = parseInt(match[1], 10);
        await handleBudgetSelection("custom", amount);
        return;
      }
    }

    setBudgetPromptLoading(true);
    const intentType = await classifyIntent(text.trim());
    setBudgetPromptLoading(false);

    if (intentType === "recommend" || intentType === "refine") {
      if (confirmedBudget) {
        addUserMessage(text.trim());
        await fetchRecommendations(
          text.trim(),
          confirmedBudget.choice,
          confirmedBudget.customCeiling
        );
      } else {
        await startBudgetConfirmation(text.trim());
      }
    } else {
      await sendDirectToChat(text.trim());
    }
  }

  async function handleFindFood() {
    if (!location || loading) return;
    addUserMessage("Find me somewhere to eat right now in my budget.");
    addAssistantMessage("On it! Remember, you can fine-tune your cuisine and dietary preferences in your profile.");
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

    if (chip.skipConfirmation && chip.budgetChoice) {
      addUserMessage(chip.label);
      fetchRecommendations(
        chip.label,
        chip.budgetChoice,
        null,
        "wildcard" in chip && (chip as Record<string, unknown>).wildcard === true
      );
    } else {
      startBudgetConfirmation(chip.label, false);
    }
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
  const hasStarted = messages.length > 0 || loading || budgetPromptLoading;

  const layoutProps: LayoutProps = {
    messages,
    input,
    setInput,
    loading,
    budgetPromptLoading,
    locationReady,
    locationPending,
    locationFailed,
    locError: locError ?? null,
    hasStarted,
    pendingConfirmation,
    showBudgetChips,
    setShowBudgetChips,
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
    handleBudgetSelection,
    handleCardClick,
    handleCardSelect,
    requestLocation,
    greeting,
    onNewChat: resetChat,
    welcomeChips: [
      FIXED_CHIP,
      ...DYNAMIC_CHIP_TEMPLATES.map((tpl, i) => ({ ...tpl, label: dynamicLabels[i] })),
    ],
    budgetChips: BUDGET_CHIPS,
  };

  return (
    <ActiveLayout {...layoutProps} />
  );
}
