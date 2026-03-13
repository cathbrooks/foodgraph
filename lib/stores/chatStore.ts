import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ChatMessage,
  BudgetChoice,
  RecommendationContext,
  SessionState,
  StateUpdates,
} from "@/types/chat";
import { EMPTY_SESSION_STATE } from "@/types/chat";
import type { PlaceDetails } from "@/types/restaurant";

interface ChatState {
  messages: ChatMessage[];
  lastRecommendations: RecommendationContext[];
  sessionState: SessionState;
  placeDetails: Record<string, PlaceDetails>;
  selectedPlaceId: string | null;
  confirmedBudget: { choice: BudgetChoice; customCeiling: number | null } | null;
  dynamicLabels: string[];
  greeting: string;
}

interface ChatActions {
  setMessages: (
    fn: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  setLastRecommendations: (recs: RecommendationContext[]) => void;
  setSessionState: (
    fn: SessionState | ((prev: SessionState) => SessionState),
  ) => void;
  mergeStateUpdates: (updates: StateUpdates) => void;
  setPlaceDetails: (
    fn:
      | Record<string, PlaceDetails>
      | ((prev: Record<string, PlaceDetails>) => Record<string, PlaceDetails>),
  ) => void;
  setSelectedPlaceId: (id: string | null) => void;
  setConfirmedBudget: (
    budget: { choice: BudgetChoice; customCeiling: number | null } | null,
  ) => void;
  setDynamicLabels: (labels: string[]) => void;
  setGreeting: (g: string) => void;
  reset: () => void;
}

const DEFAULT_DYNAMIC_LABELS = [
  "I'm craving Thai food",
  "Somewhere vegetarian-friendly",
  "Surprise me \u2014 anything goes!",
  "What's good for a group dinner?",
  "I'm feeling fancy",
];

const INITIAL_STATE: ChatState = {
  messages: [],
  lastRecommendations: [],
  sessionState: { ...EMPTY_SESSION_STATE },
  placeDetails: {},
  selectedPlaceId: null,
  confirmedBudget: null,
  dynamicLabels: DEFAULT_DYNAMIC_LABELS,
  greeting: "Hungry?",
};

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setMessages: (fn) =>
        set((s) => ({
          messages: typeof fn === "function" ? fn(s.messages) : fn,
        })),

      setLastRecommendations: (recs) => set({ lastRecommendations: recs }),

      setSessionState: (fn) =>
        set((s) => ({
          sessionState: typeof fn === "function" ? fn(s.sessionState) : fn,
        })),

      mergeStateUpdates: (updates) => {
        if (!updates) return;
        set((s) => {
          const next = { ...s.sessionState };
          if (updates.restaurants) {
            const existing = new Set(
              s.sessionState.restaurants.map((r) => r.place_id),
            );
            const newRecs = updates.restaurants.filter(
              (r) => !existing.has(r.place_id),
            );
            next.restaurants = [...s.sessionState.restaurants, ...newRecs];
          }
          if (updates.restaurantDetails) {
            next.restaurantDetails = {
              ...s.sessionState.restaurantDetails,
              ...updates.restaurantDetails,
            };
          }
          if (updates.selectedRestaurant !== undefined) {
            next.selectedRestaurant = updates.selectedRestaurant;
          }
          return { sessionState: next };
        });
      },

      setPlaceDetails: (fn) =>
        set((s) => ({
          placeDetails: typeof fn === "function" ? fn(s.placeDetails) : fn,
        })),

      setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),

      setConfirmedBudget: (budget) => set({ confirmedBudget: budget }),

      setDynamicLabels: (labels) => set({ dynamicLabels: labels }),

      setGreeting: (g) => set({ greeting: g }),

      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: "foodclaw_chat",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
