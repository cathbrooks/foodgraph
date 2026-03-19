# Migration Plan: Foodgraph → Claude Agent SDK

Generated: 2026-03-19
Source: architecture-map.md
Target: Two-agent Claude pattern — Foodclaw recommendation agent + Onboarding agent, powered by `@anthropic-ai/sdk`

---

## Migration Summary

**Current state:** Foodgraph uses a LangGraph `StateGraph` (10 nodes, conditional edges) to orchestrate OpenAI calls across a sequential recommendation pipeline. Intent classification fires twice per message (client pre-flight + in-graph). Onboarding pages exist but are unlinked from signup. All conversation context lives in client `sessionStorage`.

**Target state:** Two Claude agents built on `@anthropic-ai/sdk` with tool use. The Foodclaw main agent replaces the entire LangGraph pipeline — it decides when to search for restaurants, look up details, or respond conversationally, using tools backed by the existing filter/score/cache infrastructure. A new Onboarding agent guides first-time users through preference and budget setup. OpenAI and LangChain are fully removed.

**Estimated phases:** 6
**Risk level:** Medium — big-bang means the chat endpoint is broken between Phase 2 and Phase 3 completion. All other routes remain functional throughout.
**Key constraint:** $25/day API budget. Model choices are sized accordingly.

**Model assignments:**
| Use | Model | Rationale |
|-----|-------|-----------|
| Foodclaw main agent | `claude-sonnet-4-6` | Tool-use reasoning, multi-turn follow-up quality |
| Onboarding agent | `claude-sonnet-4-6` | Conversational extraction, runs infrequently |
| Welcome chips | `claude-haiku-4-5-20251001` | Simple generation, ~10× cheaper than Sonnet |
| Restaurant insights (web search) | `claude-sonnet-4-6` | Web search tool + quality synthesis |

---

## Component Disposition

### KEEP (no changes required)
| Component | Location | Notes |
|-----------|----------|-------|
| Google Places nearby + text search | `lib/restaurants/restaurantProvider.ts` | Becomes a tool implementation target |
| Restaurant cache (read-through) | `lib/restaurants/restaurantCache.ts` | Called by the search tool |
| Google Place Details fetch + cache | `lib/restaurants/googlePlacesProvider.ts`, `googlePlacesCache.ts` | Called by the details tool |
| Filter pipeline | `lib/restaurants/filters.ts` | Called by the search tool |
| Scoring algorithm | `lib/scoring/recommendationScorer.ts` | Called by the search tool |
| Wildcard engine | `lib/wildcard/wildcardEngine.ts` | Called by the search tool when wildcard requested |
| Budget slot resolver | `lib/budgets/slotResolver.ts` | Called in agent context setup |
| Personalization engine | `lib/personalization/personalizationEngine.ts` | Called in agent context setup |
| All Supabase tables + migrations | `supabase/migrations/` | Schema unchanged |
| Supabase auth + middleware | `lib/supabase/`, `middleware.ts` | Minor addition: onboarding redirect |
| All frontend UI components | `components/` | Untouched |
| Onboarding UI pages | `app/(app)/onboarding/` | Now properly wired to the onboarding agent |
| Settings pages | `app/(app)/settings/` | Untouched |
| Budget slot API routes | `app/api/budget-slots/` | Untouched |
| User actions API route | `app/api/user-actions/` | Untouched |
| Profile API route | `app/api/profile/` | Untouched |
| Capacitor setup | `capacitor.config.ts`, `lib/platform.ts`, `lib/api.ts` | Untouched |
| Shared types | `types/budget.ts`, `types/profile.ts`, `types/action.ts`, `types/restaurant.ts` | Untouched |
| Utility libraries | `lib/utils/`, `lib/geolocation.ts`, `lib/navigation.ts` | Untouched |

### RIP OUT (replaced by target architecture)
| Component | Location | Replaced By | Phase |
|-----------|----------|-------------|-------|
| LangGraph StateGraph | `lib/graph/recommendationGraph.ts`, `lib/graph/state.ts` | Claude agent runner | 3 |
| All 10 graph nodes | `lib/graph/nodes/*.ts` | Tool implementations + agent reasoning | 2, 3 |
| Graph edge conditionals | `lib/graph/edges/conditionals.ts` | Agent decides routing natively | 3 |
| Chat orchestrator | `lib/chat/chatOrchestrator.ts` | Agent runner | 3 |
| OpenAI client (LangChain) | `lib/ai/client.ts` | `lib/ai/anthropicClient.ts` | 1 |
| Intent system prompt | `lib/ai/prompts/intentPrompt.ts` | Folded into Foodclaw agent system prompt | 3 |
| Intent Zod schema | `lib/ai/schemas/intentSchema.ts` | Folded into tool input schemas | 2 |
| Explanation prompt builder | `lib/chat/explanationPrompt.ts` | Folded into agent behavior | 3 |
| Recommendation tracker | `lib/chat/trackRecommendation.ts` | `lib/agent/tools/trackRecommendation.ts` | 2 |
| Pre-flight classify route | `app/api/chat/classify/route.ts` | Agent understands intent natively | 3 |
| Budget prompt route | `app/api/chat/budget-prompt/route.ts` | Agent asks conversationally | 3 |
| `@langchain/langgraph` package | `package.json` | `@anthropic-ai/sdk` | 1 |
| `@langchain/openai` package | `package.json` | `@anthropic-ai/sdk` | 1 |
| `openai` package | `package.json` | `@anthropic-ai/sdk` | 1 |

### MODIFY (stays but changes)
| Component | Location | What Changes | Phase |
|-----------|----------|--------------|-------|
| Anthropic SDK client | `lib/ai/client.ts` → `lib/ai/anthropicClient.ts` | Replaces OpenAI `ChatOpenAI` with `Anthropic` singleton | 1 |
| Main chat API route | `app/api/chat/route.ts` | Calls agent runner instead of chatOrchestrator; handles streaming | 3 |
| Restaurant insights | `lib/ai/searchPreview.ts` | Replaces `gpt-4o-search-preview` with Claude + `web_search` tool | 5 |
| Welcome chips route | `app/api/chat/welcome-chips/route.ts` | Swaps OpenAI call for Anthropic Haiku call | 5 |
| Chat page | `app/(app)/chat/page.tsx` | Removes classify pre-flight, removes budget-prompt call, handles streaming responses, passes budget chip context as message metadata | 4 |
| Zustand chat store | `lib/stores/chatStore.ts` | Streaming delta handling; remove `lastRecommendations` (now implicit in message history) | 4 |
| Middleware | `middleware.ts` | Adds redirect: authenticated users with no preferences → `/onboarding/welcome` | 4 |
| `types/chat.ts` | `types/chat.ts` | `ChatRequest` loses `last_recommendations`; `ChatResponse` gains optional streaming fields | 3 |

### BUILD NEW (doesn't exist yet)
| Component | Purpose | Dependencies | Phase |
|-----------|---------|--------------|-------|
| `lib/ai/anthropicClient.ts` | Anthropic SDK singleton (replaces `lib/ai/client.ts`) | `@anthropic-ai/sdk` | 1 |
| `lib/agent/runner.ts` | Shared agentic tool-use loop (send → parse tool calls → execute → feed back → repeat) | Anthropic client | 1 |
| `lib/agent/tools/searchRestaurants.ts` | Tool: fetches, filters, and scores restaurants; returns top results | restaurantCache, filters, scorer, wildcardEngine | 2 |
| `lib/agent/tools/getRestaurantDetails.ts` | Tool: fetches Google Place Details for a given place_id | googlePlacesProvider | 2 |
| `lib/agent/tools/trackRecommendation.ts` | Tool: writes a `recommendation_event` row; returns event_id | Supabase server client | 2 |
| `lib/agent/tools/savePreferences.ts` | Onboarding tool: upserts `user_preferences` row | Supabase server client | 4 |
| `lib/agent/tools/createBudgetSlot.ts` | Onboarding tool: inserts a `budget_slots` row | Supabase server client | 4 |
| `lib/agent/tools/completeOnboarding.ts` | Onboarding tool: signals completion; sets a `onboarding_completed` flag | Supabase server client | 4 |
| `lib/agent/foodclawAgent.ts` | Foodclaw agent definition — system prompt builder, tool set, model config | All tools from Phase 2 | 3 |
| `lib/agent/onboardingAgent.ts` | Onboarding agent definition — system prompt, tools, termination logic | Onboarding tools from Phase 4 | 4 |
| `app/api/agent/chat/route.ts` | New chat endpoint for Foodclaw agent (replaces `/api/chat`) | foodclawAgent, runner | 3 |
| `app/api/agent/onboarding/route.ts` | Onboarding chat endpoint | onboardingAgent, runner | 4 |
| `app/(app)/onboarding/chat/page.tsx` | Chat UI wired to the onboarding agent (reuses layout/components) | onboarding API route | 4 |
| `supabase/migrations/013_add_onboarding_completed.sql` | Adds `onboarding_completed` boolean to `profiles` | — | 4 |

---

## Phase 1: Foundation — SDK Setup & Agent Infrastructure

**Goal:** Anthropic SDK is installed and initialized. The agentic loop runner exists and is tested standalone. OpenAI/LangChain packages are removed from dependencies (but graph code is left in place — don't break the running app yet).
**Depends on:** Nothing — this is first.
**Estimated scope:** Small

### Task 1.1: Swap SDK Dependencies
- **What:** Install `@anthropic-ai/sdk`. Remove `@langchain/langgraph`, `@langchain/openai`, and `openai` from `package.json`. Do NOT delete the files that use them yet — those will be ripped in Phase 3. Just update the lockfile.
- **Why:** Establishes the new dependency baseline before touching any logic.
- **Inputs:** Current `package.json`
- **Outputs:** `package.json` and `package-lock.json` with `@anthropic-ai/sdk` added and the three LangChain/OpenAI packages removed. App still builds (the old import sites will have type errors, but the build can be suppressed temporarily with `// @ts-ignore` or by keeping the old packages until Phase 3).
- **Note:** If keeping old packages temporarily to avoid breaking the running app, mark them with a `# REMOVE IN PHASE 3` comment in package.json.
- **Acceptance criteria:**
  - [ ] `@anthropic-ai/sdk` appears in `node_modules`
  - [ ] `npm run build` completes (with temporary suppression of LangChain type errors if needed)

### Task 1.2: Create Anthropic Client Singleton
- **What:** Create `lib/ai/anthropicClient.ts`. Export a `getAnthropicClient()` function that lazily initializes and returns a singleton `Anthropic` instance using `ANTHROPIC_API_KEY` from env. Mirror the pattern of existing `lib/ai/client.ts`.
- **Why:** Single initialization point; all agents and tool calls share one client.
- **Inputs:** `lib/ai/client.ts` (pattern reference), `lib/env.ts`
- **Outputs:** `lib/ai/anthropicClient.ts`
- **Acceptance criteria:**
  - [ ] `getAnthropicClient()` returns an `Anthropic` instance
  - [ ] Throws a clear error if `ANTHROPIC_API_KEY` is missing from env
  - [ ] Add `ANTHROPIC_API_KEY` to `.env.local` and CLAUDE.md environment setup section

### Task 1.3: Build the Shared Agent Runner
- **What:** Create `lib/agent/runner.ts`. Implement a `runAgent()` function that takes `{ messages, systemPrompt, tools, model, maxTurns? }` and executes the agentic tool-use loop:
  1. Call `client.messages.create()` with the provided config
  2. If `stop_reason === "tool_use"`: extract tool_use blocks, execute each tool, append `tool_result` blocks back to messages, recurse
  3. If `stop_reason === "end_turn"`: return the final `ContentBlock[]`
  4. If `maxTurns` is exceeded: throw a `MaxTurnsExceeded` error

  Also export a `streamAgent()` variant that uses `client.messages.stream()` and yields text delta events for streaming to the client.
- **Why:** This is the engine that powers both agents. Centralizing it means both agents share the same error handling, retry logic, and turn limit enforcement.
- **Inputs:** `lib/ai/anthropicClient.ts`, `@anthropic-ai/sdk` types
- **Outputs:** `lib/agent/runner.ts` exporting `runAgent()` and `streamAgent()`
- **Acceptance criteria:**
  - [ ] `runAgent()` correctly handles: pure text response, single tool call, multiple sequential tool calls, multiple tool calls in one turn
  - [ ] Tools are called with their input parsed from the `tool_use` content block
  - [ ] `tool_result` content is correctly formatted and appended as a `user` role message
  - [ ] `maxTurns` defaults to 5; exceeding it throws a typed error
  - [ ] `streamAgent()` yields text deltas via an `AsyncIterable`

### Phase 1 Checkpoint
When this phase is complete, you should be able to:
- Call `runAgent()` in a standalone test script with a dummy tool and verify the loop executes correctly
- `getAnthropicClient()` returns a working client (verify with a simple `messages.create` ping)
- The existing app still runs on `npm run dev` (chat still uses LangGraph — nothing has broken yet)

---

## Phase 2: Tool Library

**Goal:** All four tools that the Foodclaw agent needs are implemented, tested in isolation, and typed. These tools are pure functions that wrap existing infrastructure — no agent wiring yet.
**Depends on:** Phase 1 (runner, client)
**Estimated scope:** Medium

### Task 2.1: Implement `search_restaurants` Tool
- **What:** Create `lib/agent/tools/searchRestaurants.ts`. This tool is the replacement for the `fetchRestaurants` → `filterAndScore` → `selectWildcard` LangGraph path.

  **Tool input schema:**
  ```typescript
  {
    cuisine?: string;        // e.g. "thai", "italian"
    dietary?: string;        // e.g. "vegetarian", "gluten-free"
    search_query?: string;   // e.g. "coffee shops", "brunch spots"
    budget_ceiling?: number; // max $/person
    budget_floor?: number;   // min $/person (upscale requests)
    wildcard?: boolean;      // true = run wildcard engine instead
  }
  ```

  **Tool implementation:**
  1. Call `getRestaurantsWithCache({ location, radiusKm, query })` — location and radiusKm come from the context object passed to the tool at call time (not from Claude's input — the agent doesn't know the user's coordinates)
  2. Construct a synthetic `BudgetSlot` from `budget_ceiling`/`budget_floor` inputs, merged with the active slot from context if neither is provided
  3. Run `filterRestaurants()` with the budget + dietary + cuisine overrides
  4. Run `scoreRestaurants()` to get top results
  5. If `wildcard === true`: run `selectWildcard()` instead of scoring
  6. Return a structured array of results (name, place_id, cuisine, price, rating, distance, score breakdown, why_picked summary)

  **Tool context object** (not from Claude — injected at call time):
  ```typescript
  interface ToolContext {
    userId: string;
    location: Location;
    radiusKm: number;
    activeSlot: BudgetSlot | null;
    preferences: UserPreferences | null;
    personalization: PersonalizationHints | null;
    budgetChoice: 'slot' | 'custom' | 'none';
    customBudgetCeiling: number | null;
  }
  ```
  Pass context via closure when building the tool handler — `buildSearchRestaurantsTool(context)`.

- **Why:** This collapses 4 LangGraph nodes (fetchRestaurants, filterAndScore, selectWildcard, generateExplanations) into one tool. The agent decides when to call it and with what parameters based on the conversation.
- **Inputs:** `restaurantCache.ts`, `filters.ts`, `recommendationScorer.ts`, `wildcardEngine.ts`, `slotResolver.ts`
- **Outputs:** `lib/agent/tools/searchRestaurants.ts` exporting `buildSearchRestaurantsTool(context)` → Anthropic `Tool` object with handler
- **Acceptance criteria:**
  - [ ] Returns ≥1 result for a valid location with no filters
  - [ ] `cuisine` filter correctly narrows results
  - [ ] `wildcard: true` returns exactly one result with `is_wildcard: true`
  - [ ] `budget_ceiling` overrides active slot max
  - [ ] Returns empty array (not error) when no restaurants match filters
  - [ ] Tool input/output shapes match Anthropic tool schema format

### Task 2.2: Implement `get_restaurant_details` Tool
- **What:** Create `lib/agent/tools/getRestaurantDetails.ts`. Wraps `getGooglePlaceDetails()`.

  **Tool input schema:**
  ```typescript
  {
    place_id: string;
    name: string;
    address: string;
  }
  ```

  **Tool implementation:**
  1. Call `getGooglePlaceDetails(place_id, name, address)` — this already handles Supabase cache check + Google API call
  2. Return the `PlaceDetails` object as the tool result (hours, reviews, website, dine-in/delivery/takeout, photos, known_for)

  **Note:** The `known_for` field currently comes from `fetchRestaurantInsights` (gpt-4o-search-preview). In Phase 5, this will be updated to use Claude with `web_search`. For now, it can stay as the OpenAI call or return `[]` temporarily — the details are still useful without it.

- **Inputs:** `lib/restaurants/googlePlacesProvider.ts`
- **Outputs:** `lib/agent/tools/getRestaurantDetails.ts`
- **Acceptance criteria:**
  - [ ] Returns cached result on second call for the same place_id
  - [ ] Returns graceful empty-ish object if Google API fails (no crash)
  - [ ] `known_for` returns `[]` if insights are not yet migrated

### Task 2.3: Implement `track_recommendation` Tool
- **What:** Create `lib/agent/tools/trackRecommendation.ts`. Wraps the Supabase write that currently lives in `lib/chat/trackRecommendation.ts`.

  **Tool input schema:**
  ```typescript
  {
    results: Array<{
      place_id: string;
      name: string;
      score: ScoreBreakdown;
      is_wildcard: boolean;
    }>;
    candidate_count: number;
    filters_applied: {
      budget: boolean;
      open_now: boolean;
      max_distance_km: number;
      dietary: string[];
      cuisine_override: string | null;
    };
  }
  ```

  **Tool implementation:**
  1. Insert a row into `recommendation_events` via Supabase server client
  2. Return `{ event_id: string }` — the agent includes this in its response so the client can store it for user action tracking

  The tool needs `userId`, `location`, and `slot_id` from context (injected via closure like Task 2.1).

- **Inputs:** `lib/chat/trackRecommendation.ts` (logic reference), Supabase server client
- **Outputs:** `lib/agent/tools/trackRecommendation.ts`
- **Acceptance criteria:**
  - [ ] Successfully inserts a row into `recommendation_events`
  - [ ] Returns the new row's UUID as `event_id`
  - [ ] Failure is non-fatal — returns `{ event_id: null }` rather than throwing

### Phase 2 Checkpoint
When this phase is complete, you should be able to:
- Call each tool function directly in isolation with test data and verify correct behavior
- The existing LangGraph app still runs — these tools are not wired to anything yet

---

## Phase 3: Foodclaw Main Agent

**Goal:** The Foodclaw agent is live. The main `/api/chat` endpoint is replaced. The LangGraph graph, nodes, orchestrator, and duplicate classify route are all deleted. The chat page works end-to-end with the new agent.
**Depends on:** Phase 1 (runner), Phase 2 (tools)
**Estimated scope:** Large — this is the critical phase. The app is in a broken state until this phase is complete.

### Task 3.1: Define the Foodclaw Agent
- **What:** Create `lib/agent/foodclawAgent.ts`.

  **System prompt** (build dynamically per-request):
  ```
  You are Foodclaw, a warm and direct restaurant recommendation assistant.

  ## User Context
  - Active budget slot: {slot.label} (${slot.min_budget}–${slot.max_budget}/person) [or "None active"]
  - Cuisine preferences: {preferences.cuisines} [or "Not set"]
  - Dietary restrictions: {preferences.dietary_restrictions} [or "None"]
  - Search radius: {radiusKm} km
  - Distance unit: {preferences.distance_unit}
  - Personalization hints: {top 3 preferred cuisines, avg selected price} [if available]

  ## Budget Context
  {if budgetChoice === 'slot'}: The user has selected to use their active budget slot for this session.
  {if budgetChoice === 'custom'}: The user has set a custom budget of under ${customBudgetCeiling}/person.
  {if budgetChoice === 'none'}: The user has said budget doesn't matter right now.
  {if budgetChoice === null}: Budget not yet confirmed. If the user asks for recommendations, ask about their budget preference before searching — keep it casual (one sentence, not a form).

  ## Session Restaurants
  {list of place_id + name for all restaurants shown this session — for context resolution}

  ## Rules
  - When the user wants restaurant recommendations, call search_restaurants with appropriate parameters.
  - When the user asks about a specific restaurant (hours, menu, reviews, etc.), call get_restaurant_details.
  - After returning recommendations, call track_recommendation so we can log the event. Include the returned event_id in your response as a JSON metadata field at the end: {"_event_id": "..."}
  - For follow-up questions (reactions, general food chat, budget questions), answer conversationally. Do not search.
  - Keep responses concise. For recommendations, let the restaurant cards do the visual work — your text is the intro line only.
  - Do not fabricate restaurant details. If you don't know, say so.
  - The user's location is known — never ask for it.
  ```

  **Tool set:**
  - `search_restaurants` (from Task 2.1)
  - `get_restaurant_details` (from Task 2.2)
  - `track_recommendation` (from Task 2.3)

  Export `buildFoodclawAgent(context: ToolContext)` → `{ systemPrompt: string, tools: Tool[], model: string }`

- **Inputs:** All three tools from Phase 2, `ToolContext` type
- **Outputs:** `lib/agent/foodclawAgent.ts`
- **Acceptance criteria:**
  - [ ] System prompt correctly injects all context fields
  - [ ] All three tools are included in the tool set
  - [ ] `model` is set to `"claude-sonnet-4-6"`

### Task 3.2: Replace the Chat API Route
- **What:** Rewrite `app/api/chat/route.ts`. Replace the `chatOrchestrator` call with:

  1. Auth check (keep as-is)
  2. Parse + validate request body against updated `ChatRequestSchema` (remove `last_recommendations` field; it's now in `messages`)
  3. Load context: `resolveActiveSlot()`, `user_preferences`, `getPersonalizationHints()` — same three parallel Supabase calls as the old `resolveContext` node
  4. Build `ToolContext` from loaded context + request fields
  5. Build agent config: `buildFoodclawAgent(context)`
  6. Transform client `history` array into Anthropic `MessageParam[]` format
  7. Append the new user message
  8. Call `streamAgent()` from the runner
  9. Stream the response back as SSE (`text/event-stream`) — yield text deltas as they arrive
  10. When stream completes, parse the full response to extract `_event_id` metadata and any restaurant data, then send a final SSE event with the structured metadata

  **Updated `ChatRequest` shape:**
  ```typescript
  {
    message: string;
    location: Location;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    budget_choice: 'slot' | 'custom' | 'none' | null;
    custom_budget_ceiling: number | null;
    include_wildcard: boolean;
    session_restaurants: Array<{ place_id: string; name: string }>; // replaces last_recommendations
    timezone: string;
  }
  ```

- **Inputs:** `buildFoodclawAgent`, `runAgent`/`streamAgent` from runner, Supabase data loaders
- **Outputs:** Rewritten `app/api/chat/route.ts`
- **Acceptance criteria:**
  - [ ] Auth check works — 401 on unauthenticated request
  - [ ] Tool calls execute correctly (verify `search_restaurants` fires when asking for recommendations)
  - [ ] Streaming response arrives on client (text appears incrementally)
  - [ ] `_event_id` is returned in final metadata event
  - [ ] Follow-up questions return text-only response (no tool calls)

### Task 3.3: Delete the LangGraph Layer
- **What:** Delete all files in `lib/graph/`, delete `lib/chat/chatOrchestrator.ts`, delete `lib/chat/trackRecommendation.ts`, delete `lib/chat/explanationPrompt.ts`, delete `lib/ai/prompts/intentPrompt.ts`, delete `lib/ai/schemas/intentSchema.ts`, delete `lib/ai/client.ts` (OpenAI), delete `app/api/chat/classify/route.ts`, delete `app/api/chat/budget-prompt/route.ts`. Remove `@langchain/langgraph`, `@langchain/openai`, `openai` from `package.json`.
- **Why:** These are fully replaced by the agent. Keeping them creates confusion about what's canonical.
- **Inputs:** Confidence that Task 3.2 passes acceptance criteria
- **Outputs:** Clean `lib/` with no LangChain or OpenAI references
- **Acceptance criteria:**
  - [ ] `npm run build` passes with zero LangChain/OpenAI imports
  - [ ] No files in `lib/graph/`, no `chatOrchestrator.ts`
  - [ ] `package.json` has no `@langchain/*` or `openai` entries

### Phase 3 Checkpoint
When this phase is complete, you should be able to:
- Send a message in the chat UI and get a streaming recommendation response
- Ask a follow-up question about a restaurant and get a conversational answer
- Request a wildcard and get a single unexpected pick
- Verify `recommendation_events` row appears in Supabase after a recommendation

---

## Phase 4: Onboarding Agent & First-Run Flow

**Goal:** New users are guided through preference and budget setup by a conversational agent before reaching the chat. The onboarding → chat handoff is wired. Existing users with complete profiles are unaffected.
**Depends on:** Phase 1 (runner), Phase 3 (app functional)
**Estimated scope:** Medium-Large

### Task 4.1: Add `onboarding_completed` to Profiles
- **What:** Write migration `supabase/migrations/013_add_onboarding_completed.sql`. Add `onboarding_completed boolean not null default false` to the `profiles` table. Users created before this migration are `false` by default — they'll be prompted to onboard (acceptable for a fresh MVP).
- **Inputs:** Existing profiles migration
- **Outputs:** Migration file + applied to local Supabase
- **Acceptance criteria:**
  - [ ] Column exists in `profiles`
  - [ ] Existing rows have `onboarding_completed = false`

### Task 4.2: Implement Onboarding Tools
- **What:** Create three tool files:

  **`lib/agent/tools/savePreferences.ts`**
  Input: `{ cuisines: string[], dietary_restrictions: string[], travel_radius_km: number }`
  Implementation: Upsert `user_preferences` row for `userId` (from context closure)
  Returns: `{ success: true }`

  **`lib/agent/tools/createBudgetSlot.ts`**
  Input: `{ label: string, days: string[], start_time: string, end_time: string, min_budget: number, max_budget: number }`
  Implementation: Insert into `budget_slots`
  Returns: `{ slot_id: string }`

  **`lib/agent/tools/completeOnboarding.ts`**
  Input: `{}` (no parameters — agent calls this when done)
  Implementation: Update `profiles` set `onboarding_completed = true` for `userId`
  Returns: `{ redirect: '/chat' }`

- **Inputs:** Supabase server client, `userId` via context closure
- **Outputs:** Three tool files in `lib/agent/tools/`
- **Acceptance criteria:**
  - [ ] Each tool correctly writes to its respective table
  - [ ] `completeOnboarding` sets the flag and returns the redirect path

### Task 4.3: Define the Onboarding Agent
- **What:** Create `lib/agent/onboardingAgent.ts`.

  **System prompt:**
  ```
  You are the Foodclaw setup guide. You're helping a new user configure their restaurant preferences in a friendly 3-step conversation.

  Step 1 — Cuisines: Ask what cuisines they enjoy. Collect 1-5 types. Accept any format and normalize to lowercase.
  Step 2 — Dietary needs: Ask if they have any dietary restrictions (vegetarian, vegan, halal, etc.). This is optional — if they say none/skip, use [].
  Step 3 — Budget slot: Ask about their typical dining budget. Collect a label (e.g. "Weekday lunch"), the days it applies, rough time window, and min/max spend per person.

  After collecting all three, summarize what you're saving and call save_preferences and create_budget_slot. Then call complete_onboarding.

  Rules:
  - Keep each message short. One step at a time.
  - Accept natural language — don't force the user into rigid formats.
  - If the user wants to skip a step, respect it (use defaults: cuisines=[], dietary=[], radius=5km).
  - Never ask for location or payment info.
  - When calling create_budget_slot, use sensible defaults for days/times if the user is vague (e.g. "every day, all day" → all 7 days, 00:00–23:59).
  ```

  **Tool set:** `save_preferences`, `create_budget_slot`, `complete_onboarding`
  **Model:** `claude-sonnet-4-6`
  **Max turns:** 12 (enough for natural back-and-forth)

- **Outputs:** `lib/agent/onboardingAgent.ts`
- **Acceptance criteria:**
  - [ ] Agent completes the 3-step flow and calls all three tools
  - [ ] `complete_onboarding` is called as the final action
  - [ ] Agent handles skip/vague responses gracefully

### Task 4.4: Create the Onboarding API Route
- **What:** Create `app/api/agent/onboarding/route.ts`. Mirrors the chat route structure:
  1. Auth check
  2. Accept `{ message: string, history: MessageParam[] }`
  3. Build context (just `userId`)
  4. Call `streamAgent()` with onboarding agent config
  5. Stream response back
  6. When `complete_onboarding` tool fires, the final SSE event includes `{ onboarding_complete: true, redirect: '/chat' }`
- **Outputs:** `app/api/agent/onboarding/route.ts`
- **Acceptance criteria:**
  - [ ] First message gets a greeting + first question from the agent
  - [ ] Multi-turn conversation advances correctly
  - [ ] Final event includes `onboarding_complete: true`

### Task 4.5: Build the Onboarding Chat Page
- **What:** Create `app/(app)/onboarding/chat/page.tsx`. This is a minimal chat UI — a message list and an input, wired to `/api/agent/onboarding`. Reuse `ChatBubble`, `ChatThread`, and `Button` components. When the API returns `onboarding_complete: true`, call `router.push('/chat')`.
- **Outputs:** `app/(app)/onboarding/chat/page.tsx`
- **Acceptance criteria:**
  - [ ] Messages render correctly (user + assistant turns)
  - [ ] Redirect to `/chat` fires when onboarding completes
  - [ ] Back navigation is blocked during onboarding (prevent accidental exit mid-flow)

### Task 4.6: Wire the First-Run Redirect
- **What:** Update `middleware.ts`. After the existing auth check, add: if the user is authenticated AND `profiles.onboarding_completed === false` AND the requested path is `/chat` → redirect to `/onboarding/chat`.

  This requires a Supabase query in middleware — fetch just `onboarding_completed` from `profiles` for the current user. Cache the result in a cookie (`onboarding_status`) to avoid a DB hit on every request.

- **Inputs:** `lib/supabase/middleware.ts`, existing middleware pattern
- **Outputs:** Updated `middleware.ts`
- **Acceptance criteria:**
  - [ ] New user (onboarding_completed=false) is redirected to `/onboarding/chat` on first login
  - [ ] Returning user (onboarding_completed=true) reaches `/chat` directly
  - [ ] Cookie caches the status so repeated requests don't re-query Supabase

### Phase 4 Checkpoint
When this phase is complete, you should be able to:
- Sign up as a new user and be routed to the onboarding chat
- Complete the 3-step preference flow and land on `/chat` with preferences and a budget slot saved
- Verify `profiles.onboarding_completed = true`, `user_preferences` populated, and one `budget_slots` row created in Supabase

---

## Phase 5: Peripheral LLM Call Migration

**Goal:** All remaining OpenAI calls are replaced with Claude. Restaurant insights use Claude's `web_search` tool. Welcome chips use Haiku. The `budget-prompt` route (already deleted in Phase 3) is confirmed gone. The codebase is fully on Anthropic.
**Depends on:** Phase 1 (Anthropic client), Phase 3 (app functional)
**Estimated scope:** Small-Medium

### Task 5.1: Migrate Restaurant Insights to Claude with Web Search
- **What:** Rewrite `lib/ai/searchPreview.ts`. Replace the `gpt-4o-search-preview` call with a Claude call that uses the built-in `web_search` tool.

  **New implementation:**
  ```typescript
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: buildPrompt(name, address, websiteUrl)
    }]
  });
  ```

  The prompt stays largely the same — research the restaurant, return structured JSON with `summary`, `knownFor`, `atmosphere`, `hours`, `specials`, `reviews`. Claude will use web_search to find current information, then return the JSON.

  The output parsing and `RestaurantInsights` return type stay identical. The `google_place_details_cache` caching layer (check before call, write after) stays identical.

- **Inputs:** Existing `lib/ai/searchPreview.ts`, `lib/ai/anthropicClient.ts`
- **Outputs:** Rewritten `lib/ai/searchPreview.ts` with no OpenAI imports
- **Acceptance criteria:**
  - [ ] `fetchRestaurantInsights()` returns a valid `RestaurantInsights` object for a real restaurant
  - [ ] `knownFor` array is populated (not empty) when web search finds data
  - [ ] Cache hit path still returns without calling Claude
  - [ ] Timeout/abort logic works (replace `AbortController` pattern with Claude's `timeout` option or keep AbortController — either works)

### Task 5.2: Migrate Welcome Chips to Claude Haiku
- **What:** Rewrite the LLM call in `app/api/chat/welcome-chips/route.ts`. Replace `getOpenAIClient()` / `llm.invoke()` with a direct `client.messages.create()` call using `claude-haiku-4-5-20251001`. The system prompt, parsing logic, and cache behavior are unchanged.
- **Inputs:** `lib/ai/anthropicClient.ts`
- **Outputs:** Updated `app/api/chat/welcome-chips/route.ts`
- **Acceptance criteria:**
  - [ ] Route returns 5 labels matching the expected format
  - [ ] Haiku model is used (verify in Anthropic dashboard or log the model name)
  - [ ] Fallback to defaults on LLM failure still works

### Phase 5 Checkpoint
When this phase is complete, you should be able to:
- Select a restaurant card and see `known_for` populated by Claude web search (check first-hit vs cached behavior)
- See welcome chips refresh every 3rd visit (Haiku-generated labels)
- Grep the entire codebase for `openai` and `langchain` and find zero matches

---

## Phase 6: Frontend Wiring & Cleanup

**Goal:** The chat page is updated for streaming, the Zustand store is simplified, dead code is removed, and the app is fully functional end-to-end. No dead imports, no unused files, no `TODO: remove` comments.
**Depends on:** Phases 3, 4, 5
**Estimated scope:** Medium

### Task 6.1: Update Chat Page for Streaming
- **What:** Update `app/(app)/chat/page.tsx`. Key changes:
  1. **Remove `classifyIntent()`** — the agent understands intent natively. The pre-flight classify call is gone. The `setBudgetPromptLoading` state is gone.
  2. **Remove `startBudgetConfirmation()` and `handleBudgetSelection()`** — the agent handles budget conversationally. Budget chips still work: when a chip is selected, prepend budget context to the user message: `"[Budget: Use my slot / Under $X / No budget limit]\n{chipLabel}"`. The agent reads this and acts accordingly.
  3. **Update `fetchRecommendations()` and `sendDirectToChat()`** to consume the new streaming SSE response. Use `ReadableStream` with a `TextDecoder` to process text deltas and update the in-progress message incrementally.
  4. **Remove `last_recommendations` from the request body** — now in `session_state`.
  5. **Handle the final metadata event** — when the stream closes, parse the final SSE event for `recommendation_event_id` and `state_updates`. Store the event_id in `lastEventId`. Call `mergeStateUpdates()` for restaurant context.
  6. **Remove `pendingConfirmation` state** — no longer needed.

- **Inputs:** Updated `app/api/chat/route.ts` SSE format, current `chat/page.tsx`
- **Outputs:** Updated `app/(app)/chat/page.tsx`
- **Acceptance criteria:**
  - [ ] Text streams in incrementally (not all at once)
  - [ ] Budget chip sends correctly-formatted budget context
  - [ ] Restaurant cards still render after a recommendation
  - [ ] Card selection still triggers `trackAction`
  - [ ] `lastEventId` is set for subsequent user action tracking

### Task 6.2: Simplify the Zustand Chat Store
- **What:** Update `lib/stores/chatStore.ts`. Remove `lastRecommendations` state and `setLastRecommendations` action (recommendations are now part of message history). Add a streaming-friendly `appendToLastMessage(delta: string)` action for incremental text updates. Verify remaining state is still needed.
- **Outputs:** Updated `lib/stores/chatStore.ts`
- **Acceptance criteria:**
  - [ ] `lastRecommendations` is gone
  - [ ] `appendToLastMessage()` correctly appends to the last assistant message's content
  - [ ] Existing state (sessionState, placeDetails, selectedPlaceId, confirmedBudget) remains

### Task 6.3: Update Shared Types
- **What:** Update `types/chat.ts`:
  - Remove `last_recommendations` from `ChatRequestSchema` (Zod) and `ChatRequest` type
  - Add `session_restaurants: Array<{ place_id: string; name: string }>` to request
  - Update `ChatResponse` if the shape changed (streaming response format vs. current JSON)
  - Remove `RecommendationContext` if it's no longer used externally (check all imports)
- **Outputs:** Updated `types/chat.ts`, `types/recommendation.ts` if affected
- **Acceptance criteria:**
  - [ ] `npm run build` passes with no type errors
  - [ ] No unused type exports remain in `types/chat.ts`

### Task 6.4: Final Dead Code Sweep
- **What:** Systematically remove everything that's now unreachable:
  - Any remaining references to `interpretIntent`, `resolveContext`, `earlyExit`, `handleFollowup`, `generateExplanations`, `trackAndRespond`, `selectWildcard` (should be zero after Phase 3, but confirm)
  - `lib/ai/timeout.ts` — if no longer used (the runner has its own timeout logic)
  - `lib/ai/searchPreview.ts` imports — verify only the updated version remains
  - `INTENT_SYSTEM_PROMPT` export from old intent prompt (deleted in Phase 3)
  - Any `// TODO: remove` comments left during migration
  - Run `npm run lint` and fix all warnings
- **Outputs:** Clean codebase with zero dead imports
- **Acceptance criteria:**
  - [ ] `npm run lint` passes with zero errors
  - [ ] `npm run build` passes clean
  - [ ] Grep for `from "openai"`, `from "@langchain`, `from "openai"` returns zero results
  - [ ] Grep for `interpretIntent`, `chatOrchestrator`, `LangGraph` returns zero results

### Phase 6 Checkpoint (= Post-Migration Validation)
When this phase is complete, the full app should work end-to-end.

---

## Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agent calls `search_restaurants` unnecessarily (e.g. on follow-up questions) | Medium | Medium (cost + latency) | System prompt rules + test follow-up scenarios before Phase 3 ship |
| Agent doesn't call `track_recommendation` consistently | Medium | Low (analytics gap, not user-facing) | Parse agent output for presence of tracking; log warning if missing |
| Claude web_search returns stale/wrong restaurant info | Low | Medium | Cache writes prevent re-fetch; display "as of [date]" on known_for tags |
| Streaming SSE fails on mobile (Capacitor) | Medium | High | Test on iOS simulator during Phase 6; fall back to non-streaming response if `CAPACITOR_BUILD=true` |
| Onboarding agent loops or fails to call `complete_onboarding` | Low | Medium | `maxTurns: 12` hard limit; if exceeded, show manual "Skip to chat" button |
| `onboarding_completed` DB query adds latency to middleware | Medium | Low | Cookie caching in Task 4.6 eliminates repeat hits |
| Budget chips feel broken without the confirmation modal | Low | Medium | The chip label itself communicates the choice; test UX and add a toast if needed |

---

## Post-Migration Validation

When all phases are complete, verify:
- [ ] New user signup → onboarding chat → preference + slot saved → redirect to `/chat` ✓
- [ ] Existing user login → directly to `/chat` ✓
- [ ] "I'm craving Thai food" → agent calls `search_restaurants({cuisine: "thai"})` → cards render ✓
- [ ] "Something cheaper" → agent calls `search_restaurants({budget_ceiling: lower})` without re-asking budget ✓
- [ ] "Tell me more about [restaurant]" → agent calls `get_restaurant_details` → conversational answer ✓
- [ ] "Surprise me" chip → agent calls `search_restaurants({wildcard: true})` → single wildcard card ✓
- [ ] "Use my budget" chip → budget context passed → agent filters by active slot ✓
- [ ] `recommendation_events` row created after every recommendation ✓
- [ ] `user_actions` row created after card click/select ✓
- [ ] Welcome chips refresh every 3rd visit (Haiku) ✓
- [ ] Restaurant card selection shows `known_for` (Claude web_search, cached) ✓
- [ ] `npm run build` passes clean ✓
- [ ] Zero LangChain/OpenAI references in codebase ✓
- [ ] Capacitor iOS build functional (`npm run build:mobile`) ✓
