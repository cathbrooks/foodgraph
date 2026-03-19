# Architecture Map: Foodgraph (Foodclaw)

Generated: 2026-03-19
Codebase location: /Users/catbrooks/Documents/Foodgraph

---

## Tech Stack Summary

**Runtime:** Node.js (Next.js server runtime)
**Framework:** Next.js 15 (App Router), React 19
**Database:** Supabase (PostgreSQL) with Row Level Security
**Auth:** Supabase Auth (cookie-based sessions via `@supabase/ssr`)
**LLM Provider:** OpenAI — `gpt-4o` (intent, followup, early exit, classify, budget-prompt), `gpt-4o-mini` (explanations), `gpt-4o-search-preview` (restaurant insights)
**LLM Orchestration:** LangGraph (`@langchain/langgraph`) — compiled StateGraph
**External APIs:** Google Places API v1 (Nearby Search, Text Search, Place Details)
**State Management:** Zustand with sessionStorage persistence (`foodclaw_chat`)
**Mobile:** Capacitor 8 (iOS + Android) via static export mode
**Key Dependencies:** `@langchain/langgraph`, `@langchain/openai`, `openai`, `zod`, `zustand`, `@supabase/ssr`
**Deployment:** Not specified — Vercel-compatible (Next.js API routes)

---

## Architecture Diagram

```
User (Browser / Capacitor iOS/Android)
  │
  ├─ GET  /                           → Root page (redirect to /chat or /login)
  ├─ GET  /login  /signup             → Auth pages (Supabase email/password)
  │
  └─ /chat (page.tsx — client component)
        │
        ├─ Zustand chatStore (sessionStorage)
        │     └─ messages, sessionState, confirmedBudget, lastRecommendations
        │
        ├─ POST /api/chat/classify         → LLM (gpt-4o) intent pre-check
        ├─ POST /api/chat/budget-prompt    → LLM (gpt-4o) "use your budget?" text
        ├─ POST /api/chat/welcome-chips    → LLM (gpt-4o) chip label generation (every 3rd visit)
        ├─ GET  /api/profile               → user_preferences (distance_unit)
        ├─ GET  /api/restaurants/[placeId] → Google Places Details + AI insights cache
        ├─ POST /api/user-actions          → click / select / wildcard tracking
        │
        └─ POST /api/chat  ──────────────────────────────────┐
                                                             │
                                               chatOrchestrator.ts
                                                             │
                                               LangGraph StateGraph
                                                  │
                      ┌───────────────────────────┤
                      ▼                           │
              interpretIntent (gpt-4o)            │
                      │                           │
          ┌───────────┼──────────────┐            │
          ▼           ▼              ▼            │
    earlyExit   handleFollowup  lookupRestaurant  │
    (gpt-4o     (gpt-4o)        Details           │
     on NO_MATCH)               (Google Places)   │
                      │              │            │
                      └──────────────┘            │
                                                  ▼
                                          resolveContext
                                          (Supabase: slot, prefs, personalization)
                                                  │
                                          fetchRestaurants
                                          (Google Places + Supabase cache)
                                                  │
                                          filterAndScore
                                          (deterministic pipeline)
                                                  │
                                    ┌─────────────┤
                                    ▼             ▼
                              selectWildcard  generateExplanations
                              (heuristic)    (gpt-4o-mini)
                                    │             │
                                    └──────┬──────┘
                                           ▼
                                    trackAndRespond
                                    (Supabase: recommendation_events)
                                           │
                                    ChatResponse → client
```

---

## LLM Integration Map

### Call Site 1: `interpretIntent` — Intent Classification
- **Location:** `lib/graph/nodes/interpretIntent.ts:21–105`
- **Also duplicated at:** `app/api/chat/classify/route.ts` (pre-flight call from client before invoking full graph)
- **Model:** `gpt-4o` (via `@langchain/openai` `ChatOpenAI`, temperature=0)
- **Purpose:** Classifies user message into one of 8 intent types and extracts structured constraints (cuisine, price ceiling/floor, dietary, wildcard flag, target restaurant, search query).
- **System prompt summary:** Detailed classification prompt with 8 intent types, extraction rules for each constraint field, and 10+ few-shot JSON examples. Includes the list of currently-shown restaurant names for context resolution ("something cheaper" → `refine`).
- **Tools/Functions defined:** None — structured output via `response_format: json_object`, parsed against `IntentSchema` (Zod).
- **Conversation history:** Last 6 messages passed as the full `messages` array (system + history + new user message).
- **Input flow:** `userMessage` + `chatHistory` + `sessionState.restaurants` (names list)
- **Output handling:** JSON parsed → Zod validated → falls back to `{ type: "recommend", constraints: {} }` on failure. Sets `earlyExitReason: "UNKNOWN_INTENT"` if type is `unknown`.
- **Orchestration:** No loop. Single call. Timeout: 8000ms. Graph routing happens on result.
- **Cost profile:** Called on every single message. Moderate cost — gpt-4o with modest context (~2-4k tokens).

---

### Call Site 2: `/api/chat/classify` — Client-Side Pre-Flight Intent Check
- **Location:** `app/api/chat/classify/route.ts`
- **Model:** `gpt-4o` (same prompt as Call Site 1)
- **Purpose:** Lightweight pre-classification to decide whether the frontend shows a budget confirmation flow *before* sending to the full graph.
- **System prompt summary:** Identical to Call Site 1's intent prompt.
- **Conversation history:** Last 6 messages.
- **Input flow:** User types message → client hits `/api/chat/classify` → if `change_budget`, client updates `confirmedBudget` and routes directly to `/api/chat`. If `recommend`/`refine`, may trigger budget confirmation modal.
- **Output handling:** Returns only `{ type, targetRestaurant, priceCeiling, priceFloor }` — subset of intent schema.
- **Orchestration:** No loop. Single call. Timeout: 4000ms (shorter than in-graph version).
- **Note:** This is a redundant classification. The full graph's `interpretIntent` node runs the same prompt again when `/api/chat` is invoked. The intent is parsed twice per message on recommendation flows.

---

### Call Site 3: `generateExplanations` — Restaurant Explanation Copy
- **Location:** `lib/graph/nodes/generateExplanations.ts:13–64`
- **Model:** `gpt-4o-mini` (temperature=0)
- **Purpose:** Writes a 1-sentence "why it was picked" explanation for each recommended restaurant.
- **System prompt summary:** User-facing prompt (no system role — single `user` message). Provides scored restaurant data (price level, rating, distance, score breakdown) and instructs the model to reference specific data points. Explicitly told NOT to re-rank restaurants.
- **Tools/Functions defined:** None — JSON output via `response_format: json_object`, parsed against `ExplanationResponseSchema`.
- **Conversation history:** Not used. Single-turn prompt.
- **Input flow:** `scored` + `wildcard` recommendations, `slot`, `preferences.distance_unit`
- **Output handling:** Parsed → matched by `place_id` → annotates each `ScoredRecommendation` with `explanation` field. Deterministic fallback (`generateFallbackExplanations`) on LLM failure.
- **Orchestration:** No loop. Single call. Timeout: 15,000ms.
- **Cost profile:** Cheap — gpt-4o-mini, small context.

---

### Call Site 4: `handleFollowup` — Conversational Follow-Up Responses
- **Location:** `lib/graph/nodes/handleFollowup.ts:99–160`
- **Model:** `gpt-4o` (temperature=0)
- **Purpose:** Answers questions about recommended restaurants (hours, reviews, atmosphere, budget fit, etc.) using session state and optionally freshly-fetched place details.
- **System prompt summary:** "Foodclaw" persona prompt. Injects the full list of recommended restaurants (name, cuisine, price, rating, distance, explanation) and any fetched `RestaurantDetails` (opening hours, reviews, dine-in/delivery/takeout, website). Budget slot info included. Rules: answer directly, 2-3 sentences max, don't make up information, don't re-recommend.
- **Tools/Functions defined:** None — plain text response.
- **Conversation history:** Full `chatHistory` (last N messages, no client-enforced limit in this node).
- **Input flow:** `sessionState.restaurants`, `sessionState.restaurantDetails`, `lookedUpDetails`, `slot`, `chatHistory`
- **Output handling:** Raw string content → wrapped in a `ChatMessage`. `stateUpdates.restaurantDetails` populated if `lookedUpDetails` was fetched.
- **Orchestration:** No loop. Single call. Timeout: 8000ms.
- **Cost profile:** Moderate — gpt-4o. May run on every non-recommendation message.

---

### Call Site 5: `earlyExit` — Zero-Results Explanation
- **Location:** `lib/graph/nodes/earlyExit.ts:52–96`
- **Model:** `gpt-4o` (temperature not explicitly set — uses client default=0)
- **Purpose:** Generates a warm, helpful message when no restaurants match filters. Static strings used for other exit reasons (UNKNOWN_INTENT, NO_ACTIVE_BUDGET_SLOT, etc.).
- **System prompt summary:** "Foodclaw" persona. Provided with filter summary (cuisine, dietary, price constraints, budget slot). Instructed to write 2-3 sentences: acknowledge failure, identify likely cause, suggest 1-2 concrete fixes.
- **Tools/Functions defined:** None.
- **Conversation history:** Not used.
- **Input flow:** `earlyExitReason`, `intent.constraints`, `slot`, `budgetChoice`
- **Output handling:** Plain text → `ChatMessage`.
- **Orchestration:** No loop. Single call. Timeout: 6000ms. Only triggered on `NO_MATCHING_RESTAURANTS`.

---

### Call Site 6: `fetchRestaurantInsights` — "Known For" AI Enrichment
- **Location:** `lib/ai/searchPreview.ts:46–94`
- **Model:** `gpt-4o-search-preview` (OpenAI SDK directly, not LangChain)
- **Purpose:** When a user selects a restaurant card and details are fetched from Google, this call augments the data with a "known for" list (dishes/traits), summary, atmosphere, hours, specials, and review synthesis — using web search.
- **System prompt summary:** Single `user`-role message. Asks model to research the restaurant by name and address, return structured JSON. Factual only — null fields if not found.
- **Tools/Functions defined:** None explicitly — relies on `gpt-4o-search-preview`'s built-in web search.
- **Conversation history:** Not used. Single-turn.
- **Input flow:** Restaurant `name`, `address`, optional `websiteUrl`
- **Output handling:** JSON parsed manually → `RestaurantInsights`. `knownFor` array stored in `google_place_details_cache`. Falls back to `[]` on failure.
- **Orchestration:** No loop. Single call. Custom timeout: 10,000ms via `AbortController`.
- **Cost profile:** Most expensive single call — `gpt-4o-search-preview` with web search. Only triggered on explicit restaurant card selection (not every request).

---

### Call Site 7: `welcome-chips` — Dynamic Chip Labels
- **Location:** `app/api/chat/welcome-chips/route.ts:88–116`
- **Model:** `gpt-4o`
- **Purpose:** Refreshes the 5 welcome chip labels shown on the empty state every 3rd session visit.
- **System prompt summary:** Generates exactly 5 short button labels (one per line) following a strict format: cuisine craving, dietary preference, surprise phrase, dining occasion, upscale vibe. Includes examples and character limits.
- **Tools/Functions defined:** None — plain text (newline-delimited).
- **Conversation history:** Not used.
- **Input flow:** User visit count (from `welcome_chip_cache`)
- **Output handling:** Split by newline → stored in `welcome_chip_cache`. Falls back to defaults on failure.
- **Orchestration:** No loop. Single call. Timeout: 4000ms.
- **Cost profile:** Rare — only fires every 3rd visit. Very cheap call.

---

### Call Site 8: `budget-prompt` — Budget Confirmation Question
- **Location:** `app/api/chat/budget-prompt/route.ts` *(not read, but called from `chat/page.tsx:257`)*
- **Model:** Likely `gpt-4o` — generates the "Sounds good! Stick to your budget?" prompt text shown before budget chip selection.
- **Purpose:** Produces a natural-sounding bridge question before the user picks a budget option.

---

### LLM Orchestration Summary
- **Who manages the loop:** LangGraph `StateGraph` (compiled). There is no manual tool-call loop — the graph handles all routing via edges and conditional functions.
- **Tool execution pattern:** No LLM tools/functions used. All LLM calls produce text or JSON that the app parses directly. The graph is a linear DAG with conditional branching, not a reactive agent loop.
- **Context management:** Chat history is capped to the last 6 messages on the client (`buildHistory()` in `chat/page.tsx:154-156`) before being sent to the API. No server-side context compaction.
- **Error handling:** Every graph node is wrapped in `withErrorBoundary()` (`recommendationGraph.ts:19-36`), which catches exceptions, logs them, and sets `earlyExitReason: "INTERNAL_ERROR"`. Each LLM call also has `withTimeout()` applied. Most nodes have explicit fallback values on LLM failure.
- **Cost profile:** Every message triggers at minimum 2 LLM calls (`/api/chat/classify` + `interpretIntent` inside graph). Recommendation flows add `generateExplanations`. Restaurant detail selection adds `gpt-4o-search-preview`. Moderate cost per active session; could be high with frequent use.

---

## API Dependency Map

### Google Places API v1 — Nearby & Text Search
- **Location:** `lib/restaurants/restaurantProvider.ts`
- **Purpose:** Fetches candidate restaurants near user location. Two modes: `searchNearbyRestaurants` (no query — returns restaurants sorted by distance) and `searchTextRestaurants` (text query with up to 3 pages of 20 results each).
- **Data flow in:** User lat/lng, radius (km), optional text query
- **Data flow out:** Array of `Restaurant` objects with name, address, cuisines, price level, rating, open-now status, distance, photo URL
- **Auth:** `GOOGLE_PLACES_API_KEY` env var, passed as `X-Goog-Api-Key` header
- **Error handling:** HTTP errors logged; returns empty array. No retries.
- **Caching:** 1-hour Supabase cache keyed by geohash (precision 5) + radius bucket + query slug (`restaurant_cache` table)

### Google Places API v1 — Place Details
- **Location:** `lib/restaurants/googlePlacesProvider.ts`
- **Purpose:** Fetches full place details (hours, reviews, website, photos, services) when a user selects a restaurant card.
- **Data flow in:** `googlePlaceId`
- **Data flow out:** `PlaceDetails` — website, maps URL, editorial summary, opening hours, open-now, reviews (up to 5), price level, dine-in/delivery/takeout/reservable flags, photos (up to 3), known_for
- **Auth:** Same `GOOGLE_PLACES_API_KEY`
- **Field mask:** 15 fields requested via `X-Goog-FieldMask` header
- **Caching:** Supabase `google_place_details_cache` table; check before call, write after (`putGoogleDetailsCache`)
- **Error handling:** Non-OK responses return `EMPTY_DETAILS`. No retries.

### OpenAI API
- **Location:** `lib/ai/client.ts` (LangChain), `lib/ai/searchPreview.ts` (direct SDK)
- **Auth:** `OPENAI_API_KEY` env var
- **Two clients:** `ChatOpenAI` (LangChain) for `gpt-4o` and `gpt-4o-mini`; raw `OpenAI` SDK client for `gpt-4o-search-preview`
- **Error handling:** `withTimeout()` wrapper on all LangChain calls; `AbortController` on direct SDK call. Fallbacks in every node.

### Supabase
- **Location:** `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (API routes/RSC), `lib/supabase/middleware.ts`
- **Purpose:** Auth, user data, caching
- **Auth:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Error handling:** Queries are generally `try/catch` silent-fail (cache misses swallowed). Critical data (preferences, budget slots) propagated as null and handled by downstream logic.

---

## Data Model

### `profiles`
- **Fields:** `id` (uuid PK), `user_id` (uuid FK → auth.users, unique), `display_name` (text), `created_at`, `updated_at`
- **Relationships:** 1:1 with auth.users. Auto-created by trigger on signup.
- **Purpose:** Display name / profile identity. Minimal usage currently.

### `user_preferences`
- **Fields:** `id`, `user_id` (unique FK), `cuisines` (text[]), `dietary_restrictions` (text[]), `travel_radius_km` (numeric, 0.5–50, default 5), `distance_unit` (added in migration 011 — `km` or `mi`), `created_at`, `updated_at`
- **Relationships:** 1:1 with auth.users. Auto-created on signup.
- **Purpose:** User's static food preferences. Used in filter pipeline and scoring. `travel_radius_km` controls Google Places search radius.

### `budget_slots`
- **Fields:** `id`, `user_id` (FK), `label` (text, 1-100 chars), `days` (text[], min 1), `start_time` (time), `end_time` (time), `min_budget` (numeric ≥0), `max_budget` (numeric ≥ min), `hidden` (bool, added migration 010), `created_at`, `updated_at`
- **Relationships:** Many per user. Referenced by `recommendation_events`.
- **Purpose:** Time-based budget windows. The `slotResolver` picks the active slot by matching current day + time. `hidden` flag hides without deleting.

### `recommendation_events`
- **Fields:** `id`, `user_id` (FK), `slot_id` (FK → budget_slots, nullable), `location_lat`, `location_lng`, `results` (jsonb — full scored recommendation data), `candidate_count` (int), `filters_applied` (jsonb), `created_at`
- **Relationships:** Many per user. Referenced by `user_actions`.
- **Purpose:** Full analytics log of every recommendation. `results` stores the complete scored restaurant array. Used by personalization engine to look up what was shown at the time of a user action.

### `user_actions`
- **Fields:** `id`, `user_id` (FK), `recommendation_event_id` (FK), `restaurant_place_id` (text), `action_type` (enum: click, select, wildcard_request, wildcard_select, dismiss), `metadata` (jsonb — contains `cuisines`, `avg_price` for personalization), `created_at`
- **Relationships:** Many per `recommendation_event`. The `metadata` field carries cuisine/price data at action time.
- **Purpose:** Behavioral tracking. Drives the personalization engine — last 100 actions fetched and analyzed to derive preferred cuisines, average selected price, wildcard acceptance rate.

### `restaurant_cache`
- **Fields:** `id`, `cache_key` (text, unique — `{geohash}:r{radius}[:q{query}]`), `data` (jsonb — array of `Restaurant`), `fetched_at`, `expires_at`
- **RLS:** No user policies. Service role only.
- **Purpose:** 1-hour read-through cache for Google Places search results. Keyed by geohash precision 5 (roughly ~5km cells) + radius + query. Stale cache used as fallback if Google API fails.

### `google_place_details_cache`
- **Fields:** (migration 009 + 012 — Foursquare removed, Google-only) — `place_id` (text PK), detail fields, TTL
- **Purpose:** Caches `PlaceDetails` (hours, reviews, website, photos, known_for) so repeat card selections don't re-hit Google Places Details API or re-invoke `gpt-4o-search-preview`.

### `welcome_chip_cache`
- **Fields:** (migrations 007, 008) — `user_id` (FK, unique), `labels` (text[]), `visit_count` (int), `greeting` (text, added migration 008), `updated_at`
- **Purpose:** Per-user cache for welcome chip labels and greeting text. Refreshed every 3rd visit via LLM.

---

## Auth & Session Architecture

- **Sign-up flow:** Email/password via Supabase Auth UI (`/signup` page). On successful signup, two database triggers auto-create `profiles` and `user_preferences` rows.
- **Auth mechanism:** Supabase session cookies, managed by `@supabase/ssr`. Middleware refreshes the session token on every request.
- **Session storage:** Supabase session in HTTP-only cookies. Chat state (messages, recommendations, budget choice) stored in browser `sessionStorage` via Zustand persist middleware (key: `foodclaw_chat`).
- **User identification:** Every API route calls `supabase.auth.getUser()` server-side to verify session and get `user.id`. No JWT decoding on client; no roles.
- **Route protection:** Next.js middleware (`middleware.ts`) redirects unauthenticated users to `/login` for all non-public routes. Public routes: `/`, `/login`, `/signup`.

---

## User Flow Map

### Flow 1: First Visit / Onboarding
1. User lands on `/` → middleware redirects to `/login` (not authenticated)
2. User signs up at `/signup` → Supabase creates auth user → DB triggers create `profiles` + `user_preferences` rows
3. User redirected to `/chat` *(Note: no explicit onboarding wizard is wired — the onboarding pages at `/onboarding/welcome`, `/onboarding/preferences`, `/onboarding/budget-slots` exist as UI but their navigation flow from signup is not wired in middleware)*
4. Chat page loads → fetches welcome chips (`/api/chat/welcome-chips`) and user preferences (`/api/profile`)
5. Location permission requested via browser Geolocation API (or Capacitor on native)

**Pain points:** Onboarding pages exist (`/onboarding/welcome`, `/onboarding/preferences`, `/onboarding/budget-slots`) but there is no redirect from signup to the onboarding flow in middleware. New users land directly on chat without being guided to set preferences or budget slots, which means `resolveContext` may return `null` for everything on first use.

### Flow 2: Restaurant Recommendation Request
1. User types a message (e.g. "I'm craving Thai food")
2. Client calls `/api/chat/classify` → LLM classifies intent (gpt-4o, 4s timeout)
3. If intent is `recommend` and no `confirmedBudget`: show budget confirmation flow
   - Client calls `/api/chat/budget-prompt` → LLM generates "use your budget?" question
   - User selects budget chip (slot / custom $ / no budget)
   - `confirmedBudget` stored in Zustand
4. Client calls `POST /api/chat` with message, location, budget choice, history, session state
5. Server: auth check → `chatOrchestrator` → LangGraph:
   - `interpretIntent` → classifies again (same LLM, same prompt — redundant)
   - `resolveContext` → fetches budget slot, preferences, personalization hints from Supabase
   - `fetchRestaurants` → cache check → Google Places API (nearby or text search)
   - `filterAndScore` → filter pipeline → weighted scoring → top 10
   - `generateExplanations` → gpt-4o-mini writes "why" copy
   - `trackAndRespond` → saves `recommendation_event` → returns `ChatResponse`
6. Client receives response → updates Zustand store → renders restaurant cards

### Flow 3: Restaurant Card Selection & Details
1. User taps a restaurant card → `handleCardSelect`
2. `trackAction` fires → `POST /api/user-actions` (action_type: `select` or `wildcard_select`, metadata: cuisines + avg_price)
3. If details not cached in `placeDetails` store: `GET /api/restaurants/[placeId]`
4. Server: `getPlaceDetails` → check `google_place_details_cache` → if miss: parallel fetch Google Place Details + `fetchRestaurantInsights` (gpt-4o-search-preview)
5. Details stored in Zustand `placeDetails` map and merged into `sessionState.restaurantDetails`
6. `selectedRestaurant` set in session state (used in follow-up LLM prompts)

### Flow 4: Follow-Up Question
1. User types a question about a shown restaurant (e.g. "What are the hours at Mama Sushi?")
2. Client classify → `ask_detail` intent
3. Client calls `POST /api/chat` → LangGraph routes to `lookupRestaurantDetails` node
4. Node resolves target restaurant from `sessionState` → checks for existing details → may call Google Places Details
5. `handleFollowup` node → gpt-4o answers using restaurant context + any freshly-fetched details
6. Response returned; `stateUpdates.restaurantDetails` merged on client

### Flow 5: Budget Slot Management (Settings)
1. User navigates to `/settings/budget-slots`
2. CRUD operations via `/api/budget-slots` routes (GET all, POST create, PATCH update, DELETE)
3. Slots stored in Supabase with day+time windows; `slotResolver` picks active slot per-request at recommendation time

---

## Migration-Relevant Observations

1. **Duplicate intent classification on every message.** The client calls `/api/chat/classify` to pre-classify intent, and then `interpretIntent` inside the LangGraph runs the same gpt-4o call with the same prompt. Every recommendation request pays for intent classification twice. This could be eliminated by either doing classification exclusively inside the graph or exclusively on the client (and passing the result in the `ChatRequest`).

2. **LangGraph is used as a linear DAG, not an agent loop.** The graph has no cycles, no tool-call feedback loops, and no LLM-driven routing beyond the initial intent classification. The complexity of `@langchain/langgraph` (state annotations, compiled graph, edge conditionals) adds overhead for what is essentially a sequential pipeline with one branching decision. If the recommendation logic stays this deterministic, LangGraph may be overengineered. Conversely, if you want to add agentic behavior (e.g., iterative refinement, multi-step restaurant research), the graph structure is already the right foundation.

3. **Client session state is the multi-turn memory.** There is no server-side conversation persistence. All chat history, restaurant context, and session state lives in the client's Zustand store (persisted to browser sessionStorage). The server is stateless — it receives full context on each request. This is clean and simple but means conversations are lost if the user opens a new tab or clears the browser session. No cross-device continuity.

4. **Onboarding flow is built but not wired.** Pages exist at `/onboarding/welcome`, `/onboarding/preferences`, and `/onboarding/budget-slots` but the signup → onboarding redirect is not implemented in middleware. New users land directly on `/chat` with empty preferences and no budget slots, which produces poor first-run recommendations.

5. **`gpt-4o-search-preview` used for restaurant enrichment.** This is a premium model call triggered on card selection. It runs in parallel with the Google Place Details fetch and the result (`knownFor` array) is cached in Supabase. The caching is correct, but the model is expensive relative to the value of the "known for" tags. This is a candidate for replacement with a web-scraping approach or a cheaper model.

6. **Personalization is lightweight and delayed.** The `personalizationEngine` looks at the last 100 `user_actions` and the associated `recommendation_events.results` to derive cuisine preferences and average selected price. This requires two Supabase queries on every recommendation request and contributes only a 10% weight in the scoring function. At MVP scale this is fine, but as user history grows, the query may become slower and the signal may need more sophisticated derivation.

7. **Filter pipeline can produce zero results silently.** Each filter stage in `filterRestaurants` reduces the candidate set and logs the count, but there's no early bailout — all filters run to completion even if the count hits 0 early. The `earlyExit` path then triggers an LLM call (gpt-4o) to generate a sympathetic "nothing found" message. This is expensive for a failure case; a simpler fallback string would suffice in most cases.

8. **Price data is coarse.** Average price per person is inferred from Google's `priceLevel` enum ($, $$, $$$, $$$$) mapped to fixed dollar values ($10, $20, $40, $70). This makes budget filtering and scoring imprecise. Restaurants without a `priceLevel` from Google pass the budget filter by default (`return true`), which can surface out-of-budget results.

9. **Mobile/web code split via env flag.** `CAPACITOR_BUILD=true` triggers Next.js static export mode. `lib/platform.ts` and `lib/api.ts` abstract web vs. native differences. The codebase is structured to support both targets, but the API base URL for native builds requires `NEXT_PUBLIC_API_BASE_URL` to be configured — this is currently optional and easy to miss.
