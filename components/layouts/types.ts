import type { ChatMessage, BudgetChoice } from "@/types/chat";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { PlaceDetails } from "@/types/restaurant";
import type { DistanceUnit } from "@/types/profile";

export interface LayoutProps {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  locationReady: boolean;
  locationPending: boolean;
  locationFailed: boolean;
  locError: string | null;
  hasStarted: boolean;
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
  handleCardClick: (rec: ScoredRecommendation) => void;
  handleCardSelect: (rec: ScoredRecommendation) => void;
  requestLocation: () => void;
  greeting: string;
  onNewChat: () => void;
  welcomeChips: ReadonlyArray<{ label: string; budgetChoice: BudgetChoice | null; skipConfirmation: boolean }>;
  distanceUnit: DistanceUnit;
}
