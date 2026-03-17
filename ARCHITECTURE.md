# Foodgraph Architecture

## Overview

Foodgraph is a conversational restaurant recommendation app built with Next.js 15 and React 19. Users interact through a chat interface that processes natural language requests through a **LangGraph state machine**. The graph orchestrates intent parsing, restaurant fetching, filtering, scoring, and response generation — all driven by a single shared state object that flows through each node.

The app runs as a hybrid web + native app (via Capacitor) backed by Supabase for auth, user data, and caching, with Google Places as the restaurant data source and OpenAI for LLM-powered intent parsing and explanations.

---

## Request Lifecycle

Every user interaction follows the same path: **UI → API → Orchestrator → Graph → Response**. The graph determines which nodes execute based on the user's intent.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Chat UI (app/(app)/chat/page.tsx)                                   │
│  User types message → POST /api/chat                                 │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API Route (app/api/chat/route.ts)                                   │
│  Auth check → Zod validation → handleChatRequest(userId, body)       │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Chat Orchestrator (lib/chat/chatOrchestrator.ts)                    │
│  Builds initial RecommendationState → recommendationGraph.invoke()   │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Recommendation Graph (lib/graph/recommendationGraph.ts)             │
│  LangGraph StateGraph — nodes execute in sequence with conditional   │
│  branching based on intent and error states                          │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ChatResponse returned to UI                                         │
│  { message, recommendation_event_id, state_updates }                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## The Recommendation Graph

The core of the system is a compiled LangGraph `StateGraph`. Every node receives the full `RecommendationState`, performs its work, and returns a partial state update that gets merged back in. An `withErrorBoundary` wrapper catches failures in any node and sets `earlyExitReason: "INTERNAL_ERROR"` so the graph can gracefully terminate.

### Graph Topology

```
                        ┌──────────────────┐
                        │  interpretIntent  │
                        └────────┬─────────┘
                                 │
                 ┌───────────────┼───────────────┬──────────────┐
                 │               │               │              │
            earlyExit    resolveContext    handleFollowup   lookupDetails
                 │               │               │              │
                 ▼               ▼               │              │
               [END]      fetchRestaurants       │              │
                                 │               │              ▼
                                 ▼               │       handleFollowup
                          filterAndScore         │              │
                                 │               ▼              ▼
                    ┌────────────┼─────────┐   [END]          [END]
                    │            │         │
               earlyExit  selectWildcard   │
                    │         (optional)    │
                    ▼            │          │
                  [END]          ▼          │
                        generateExplanations◄──┘
                                 │
                                 ▼
                          trackAndRespond
                                 │
                                 ▼
                               [END]
```

### Conditional Edges

Three routing functions in `lib/graph/edges/conditionals.ts` control the flow:

| Function | After Node | Routes To |
|---|---|---|
| `afterInterpretIntent` | interpretIntent | `earlyExit` (unknown intent), `lookupRestaurantDetails` (ask_detail), `handleFollowup` (followup/feedback/general), `resolveContext` (recommend/refine) |
| `shouldEarlyExit` | resolveContext, fetchRestaurants | `earlyExit` if `earlyExitReason` is set, otherwise `continue` to next node |
| `afterFilterAndScore` | filterAndScore | `earlyExit` (no matches), `selectWildcard` (if wildcard requested), `generateExplanations` (default) |

---

## Graph Nodes

### interpretIntent

**File:** `lib/graph/nodes/interpretIntent.ts`

The entry point for every request. Sends the user message plus chat history to OpenAI with a structured system prompt. Returns a JSON `Intent` with:

- **type**: `recommend`, `refine`, `ask_detail`, `followup`, `feedback`, `general`, or `unknown`
- **constraints**: extracted filters like `cuisineFilter`, `priceCeiling`, `priceFloor`, `dietaryFilter`, `searchQuery`, `targetRestaurant`, `requestedWildcard`

Falls back to `{ type: "recommend", constraints: {} }` on LLM failure or schema validation error. Has an 8-second timeout.

### resolveContext

**File:** `lib/graph/nodes/resolveContext.ts`

Loads the user's personalized context from Supabase in parallel:

1. **Active budget slot** — resolved by day/time via `slotResolver`
2. **User preferences** — cuisines, dietary restrictions, travel radius, distance unit
3. **Personalization hints** — derived from past user actions (preferred cuisines, average selected price)

Sets `radiusKm` from preferences (default 5 km). Early-exits with `NO_ACTIVE_BUDGET_SLOT` if the user chose slot-based budgeting but has no active slot.

### fetchRestaurants

**File:** `lib/graph/nodes/fetchRestaurants.ts`

Builds a search query from intent constraints (searchQuery + cuisineFilter + dietaryFilter). If a query exists, uses Google Places **Text Search**; otherwise uses **Nearby Search**.

All requests go through `restaurantCache` which provides geohash-based caching with a 1-hour TTL and stale-while-revalidate fallback.

Sets `searchSource` to `"text"` or `"nearby"` — this affects which filters are applied downstream (e.g., open-now and cuisine filters are skipped for text searches since the API handles them).

Early-exits with `NO_NEARBY_RESTAURANTS` if the result set is empty.

### filterAndScore

**File:** `lib/graph/nodes/filterAndScore.ts`

Applies a filter pipeline, then scores the survivors:

**Filters** (in order, via `lib/restaurants/filters.ts`):
1. **Open now** — skipped for text searches
2. **Cuisine override** — from intent constraints, skipped for text searches
3. **Budget** — avg price must fall within `[min * 0.8, max * 1.2]`
4. **Price floor** — from intent constraints (e.g., "somewhere fancy")
5. **Max distance** — from user's travel radius preference
6. **Dietary override** — from intent constraints
7. **Dietary restrictions** — from saved user preferences

**Scoring** (via `lib/scoring/recommendationScorer.ts`):

Each restaurant gets a weighted composite score:

| Factor | Weight | What it measures |
|---|---|---|
| Budget fit | 0.30 | How close the price is to the budget midpoint |
| Cuisine match | 0.25 | Overlap with preferred + historically selected cuisines |
| Distance | 0.20 | Proximity to user (tiered: ≤0.5 km = 1.0 → >10 km = 0.1) |
| Rating | 0.15 | Google rating normalized to 0–1 |
| Personalization | 0.10 | Match with past behavior (price & cuisine patterns) |

Top 10 results are kept. Early-exits with `NO_MATCHING_RESTAURANTS` if nothing passes filters.

### selectWildcard

**File:** `lib/graph/nodes/selectWildcard.ts`

Optional node — only runs when `includeWildcard` is true (user requested a surprise). Picks a restaurant **outside** the user's normal preferences, favoring high ratings and reasonable distance via random weighted selection.

### generateExplanations

**File:** `lib/graph/nodes/generateExplanations.ts`

Generates a short "why this pick" explanation for each recommendation using OpenAI (mini model). Falls back to template-based explanations on LLM failure. Has a 15-second timeout.

### trackAndRespond

**File:** `lib/graph/nodes/trackAndRespond.ts`

Final node in the recommendation path:

1. **Tracks** the recommendation event in Supabase (`recommendation_events` table) for analytics and personalization
2. **Builds** the `ChatResponse` with the assistant message, scored recommendations, event ID, and session state updates
3. Sets `response` on the graph state, which the orchestrator returns to the API route

### handleFollowup

**File:** `lib/graph/nodes/handleFollowup.ts`

Handles non-recommendation intents (followup questions, feedback, general chat). Uses the LLM with chat history and last recommendations as context — no new restaurant search.

### lookupRestaurantDetails

**File:** `lib/graph/nodes/lookupRestaurantDetails.ts`

Fetches Google Place Details (hours, reviews, photos, etc.) for a specific restaurant when the user asks about one. Results are cached in `google_place_details_cache` with a 24-hour TTL. Flows into `handleFollowup` to generate the conversational response.

### earlyExit

**File:** `lib/graph/nodes/earlyExit.ts`

Terminal node that maps `earlyExitReason` codes to user-friendly messages:

| Reason | User sees |
|---|---|
| `NO_ACTIVE_BUDGET_SLOT` | Prompt to set up a budget slot |
| `NO_NEARBY_RESTAURANTS` | No restaurants found nearby |
| `NO_MATCHING_RESTAURANTS` | Nothing matched the filters |
| `UNKNOWN_INTENT` | Prompt to rephrase |
| `INTERNAL_ERROR` | Generic error message |

---

## Graph State

The `RecommendationState` (defined in `lib/graph/state.ts`) is the single source of truth that flows through every node. It's defined using LangGraph's `Annotation.Root`:

| Field | Set by | Purpose |
|---|---|---|
| `userId`, `userMessage`, `location` | Orchestrator | Request context from the authenticated user |
| `budgetChoice`, `customBudgetCeiling`, `timezone` | Orchestrator | Budget mode selected by user in the UI |
| `chatHistory`, `lastRecommendations`, `sessionState` | Orchestrator | Conversational context carried between turns |
| `intent` | interpretIntent | Parsed intent type and extracted constraints |
| `slot`, `preferences`, `personalization`, `radiusKm` | resolveContext | User's budget slot, saved preferences, behavior hints |
| `searchSource`, `candidates` | fetchRestaurants | Raw restaurant results and how they were fetched |
| `filtered`, `scored` | filterAndScore | Post-filter and post-scoring results |
| `wildcard` | selectWildcard | The wildcard pick (if requested) |
| `lookedUpDetails` | lookupRestaurantDetails | Google Place Details for detail queries |
| `response` | trackAndRespond / handleFollowup / earlyExit | Final `ChatResponse` returned to the client |
| `earlyExitReason` | Any node | Signals the graph to terminate early via `earlyExit` |
| `timings` | withErrorBoundary | Per-node execution times for observability |

---

## Interaction Paths

### Path 1: New Recommendation

The most common flow. User asks for food suggestions.

```
User: "Find me a good Thai place under $30"
  → interpretIntent: { type: "recommend", constraints: { cuisineFilter: "thai", priceCeiling: 30 } }
  → resolveContext: loads budget slot, preferences, personalization
  → fetchRestaurants: text search for "thai" via Google Places (cached)
  → filterAndScore: budget + distance + dietary filters → score top 10
  → generateExplanations: LLM writes "why" for each pick
  → trackAndRespond: saves event, returns ChatResponse with recommendations
```

### Path 2: Refinement

User wants to adjust the previous results.

```
User: "Something cheaper and closer"
  → interpretIntent: { type: "refine", constraints: { priceCeiling: 20 } }
  → resolveContext → fetchRestaurants → filterAndScore → generateExplanations → trackAndRespond
```

### Path 3: Follow-up / Feedback

User asks about the results or gives feedback — no new search needed.

```
User: "Why did you pick the second one?"
  → interpretIntent: { type: "followup" }
  → handleFollowup: LLM answers using chat history + last recommendations
```

### Path 4: Restaurant Detail

User asks a specific question about a restaurant.

```
User: "What are the hours for Sushi Nakazawa?"
  → interpretIntent: { type: "ask_detail", constraints: { targetRestaurant: "Sushi Nakazawa" } }
  → lookupRestaurantDetails: fetches Google Place Details (cached 24h)
  → handleFollowup: LLM answers the question with the detail data
```

### Path 5: Wildcard

User wants a surprise pick outside their usual preferences.

```
User: "Surprise me with something different"
  → interpretIntent: { type: "recommend", constraints: { requestedWildcard: true } }
  → resolveContext → fetchRestaurants → filterAndScore
  → selectWildcard: picks something outside normal preferences
  → generateExplanations → trackAndRespond
```

---

## Caching Layers

| Cache | Storage | Key | TTL | Strategy |
|---|---|---|---|---|
| Restaurant search results | `restaurant_cache` (Supabase) | `geohash:r{radius}:q{query}` | 1 hour | Stale-while-revalidate on miss |
| Google Place Details | `google_place_details_cache` (Supabase) | `place_id` | 24 hours | Cache-first, fetch on miss |

---

## External Services

| Service | Used For | Client |
|---|---|---|
| **Supabase** | Auth, user data (preferences, budget slots), caching, analytics (recommendation events, user actions) | `@supabase/ssr` |
| **Google Places API** | Nearby Search, Text Search, Place Details | REST via `lib/restaurants/` |
| **OpenAI** | Intent parsing (gpt-4o), explanations (gpt-4o-mini) | `@langchain/openai` |

---

## Client-Side Architecture

The chat UI (`app/(app)/chat/page.tsx`) uses a **Zustand store** (`lib/stores/chatStore.ts`) to manage:

- Message history
- Session state (tracked restaurants, conversation context)
- Place detail modals
- Budget confirmation flow

Before sending the main chat request, the client may call auxiliary endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/chat/classify` | Quick intent classification to decide if budget confirmation is needed |
| `POST /api/chat/budget-prompt` | Generate the budget confirmation prompt |
| `POST /api/chat/welcome-chips` | Fetch personalized quick-action chips for the greeting |

After receiving recommendations, the client can:

- Fetch full restaurant details via `GET /api/restaurants/[placeId]`
- Track user actions (click, select, wildcard_select) via `POST /api/user-actions` — these feed back into the personalization engine
