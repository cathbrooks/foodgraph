import type { ChatMessage, BudgetChoice, RecommendationContext } from "@/types/chat";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails } from "@/types/restaurant";

export interface LayoutProps {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  budgetPromptLoading: boolean;
  locationReady: boolean;
  locationPending: boolean;
  locationFailed: boolean;
  locError: string | null;
  hasStarted: boolean;
  pendingConfirmation: {
    userMessage: string;
    assistantPrompt: string;
    includeWildcard: boolean;
  } | null;
  showBudgetChips: boolean;
  setShowBudgetChips: (v: boolean) => void;
  selectedPlaceId: string | null;
  placeDetails: Record<string, PlaceDetails>;
  detailsLoading: string | null;
  expandedMessages: Set<string>;
  setExpandedMessages: React.Dispatch<React.SetStateAction<Set<string>>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scrollToBottom: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleChipClick: (chip: { label: string; budgetChoice: BudgetChoice | null; skipConfirmation: boolean }) => void;
  handleFindFood: () => void;
  handleWildcard: () => void;
  handleBudgetSelection: (choice: BudgetChoice, customCeiling?: number | null) => void;
  handleCardClick: (rec: ScoredRecommendation) => void;
  handleCardSelect: (rec: ScoredRecommendation) => void;
  requestLocation: () => void;
  greeting: string;
  onNewChat: () => void;
  welcomeChips: ReadonlyArray<{ label: string; budgetChoice: BudgetChoice | null; skipConfirmation: boolean }>;
  budgetChips: ReadonlyArray<{ label: string; value: number }>;
}
