# Work Orders Implementation Summary

This document describes the implementation of work orders 1–20 for the Foodgraph MVP.

---

## Work Order 1: Secure Secrets + Environment Configuration

**Area:** Infrastructure  
**Description:** Store API keys securely, configure per-environment variables, ensure server-only keys are not exposed to the client.

### What Was Done

- Created `lib/env.ts` with Zod-validated schemas:
  - **Server schema:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`
  - **Client schema:** Only `NEXT_PUBLIC_*` variables (safe for browser exposure)
- `serverEnv` is validated only when `typeof window === "undefined"` (server-side)
- `clientEnv` is validated for client-side use
- Updated `lib/supabase/client.ts` and `lib/supabase/server.ts` to use validated env vars instead of raw `process.env!` assertions
- `.env.local` is gitignored; sensitive keys never reach the client bundle

---

## Work Order 2: Set Up Next.js App Scaffold + Core Routes

**Area:** Frontend  
**Description:** Initialize Next.js project, add basic routing for onboarding, chat, and settings. Establish shared layout, navigation, and environment config.

### What Was Done

- Created `(app)` route group with shared layout including `Header` for authenticated pages (`/chat`, `/onboarding/*`, `/settings/*`)
- Created `(auth)` layout for login/signup (no header)
- Root layout: `min-h-screen` styling, `ToastProvider` for app-wide notifications
- Routes: `/`, `/login`, `/signup`, `/chat`, `/onboarding/preferences`, `/onboarding/budget-slots`, `/settings/preferences`, `/settings/budget-slots`

---

## Work Order 3: Create UI Component Library for MVP Screens

**Area:** Frontend  
**Description:** Build reusable components (buttons, inputs, cards, chat bubbles, loading states, empty states) for consistent UI.

### What Was Done

- **New UI components:** `Spinner` (sm/md/lg), `Skeleton`, `EmptyState`, `Badge`, `Textarea`, `Select`, `ToastProvider` + `toast()` (imperative API with auto-dismiss)
- **Chat:** `ChatBubble` (user vs assistant styling)
- **Restaurants:** `RestaurantCardSkeleton` (loading placeholder for cards)
- All components exported via barrel `index.ts` files in `components/ui`, `components/chat`, `components/restaurants`

---

## Work Order 4: Integrate Supabase Auth (Server + Client)

**Area:** Backend  
**Description:** Configure Supabase keys, implement auth middleware/session retrieval, protect authenticated routes.

### What Was Done

- **Middleware:** Unauthenticated users hitting protected routes redirect to `/login?next=<path>`
- Authenticated users visiting `/login` or `/signup` redirect to `/chat`
- **Auth helpers:** `lib/supabase/auth.ts` — `getUser()`, `requireUser()` (server-side)
- **Client hook:** `lib/supabase/useAuth.ts` — real-time auth state via `onAuthStateChange`
- **Header:** Added `SignOutButton` for logout
- Supabase client, server, and middleware already used correct cookie handling for SSR

---

## Work Order 5: Database — Create Profiles Table + RLS Policies

**Area:** Database  
**Description:** Define profiles schema and RLS so users can only read/write their own profile.

### What Was Done

- Created `supabase/migrations/001_create_profiles.sql`:
  - Table: `profiles` (id, user_id, display_name, created_at, updated_at)
  - RLS: select/insert/update own profile
  - Trigger `on_auth_user_created`: auto-creates a profile row when a new user signs up via `auth.users`

---

## Work Order 6: Implement Authentication UI (Sign Up / Login)

**Area:** Frontend  
**Description:** Create screens for signup/login/logout and basic session handling.

### What Was Done

- **`/login`:** Email + password form, `supabase.auth.signInWithPassword()`, `?next=` redirect support, error display, `Suspense` boundary for `useSearchParams()` (Next.js 15)
- **`/signup`:** Email, password, confirm-password form, `supabase.auth.signUp()`, client-side validation (length ≥ 6, passwords match), redirect to `/onboarding/preferences` after signup

---

## Work Order 7: Database — Create User Preferences Table + RLS Policies

**Area:** Database  
**Description:** Define preferences schema (cuisines, restrictions, travel radius) with per-user RLS.

### What Was Done

- Created `supabase/migrations/002_create_user_preferences.sql`:
  - Table: `user_preferences` (id, user_id, cuisines text[], dietary_restrictions text[], travel_radius_km with CHECK 0.5–50)
  - RLS: select/insert/update own preferences
  - Trigger: auto-create default preferences on signup

---

## Work Order 8: API Route — Update User Preferences

**Area:** Backend  
**Description:** Implement endpoint to update cuisines, dietary restrictions, and travel radius for the authenticated user.

### What Was Done

- Enhanced `app/api/profile/route.ts`:
  - **PUT:** Validates body with `UpdatePreferencesSchema`, upserts `user_preferences` with `onConflict: "user_id"`
  - Improved error handling: JSON parse catch, multi-field Zod error messages

---

## Work Order 9: Create "Profile & Preferences" Onboarding Flow (UI)

**Area:** Frontend  
**Description:** Build onboarding steps for cuisine preferences, dietary restrictions, and travel radius.

### What Was Done

- **`components/onboarding/PreferencesForm.tsx`:** Reusable form with:
  - Cuisine toggle pills (15 options)
  - Dietary restriction toggle pills (8 options, "none" mutually exclusive)
  - Travel radius slider + number input (0.5–50 km)
- **`/onboarding/preferences`:** StepIndicator (1 of 2), calls `PUT /api/profile`, navigates to `/onboarding/budget-slots` on success

---

## Work Order 10: Preferences Settings Page (Post-Onboarding)

**Area:** Frontend  
**Description:** Allow users to update cuisines, dietary restrictions, and travel radius after onboarding.

### What Was Done

- **`/settings/preferences`:** Loads existing preferences via `GET /api/profile`, shows `Spinner` while loading, renders `PreferencesForm` pre-populated
- On save, shows success toast via `toast("Preferences updated", "success")`

---

## Work Order 11: Database — Create Budget Slots Table + RLS Policies

**Area:** Database  
**Description:** Schema for weekly slots (days_of_week, start_time, end_time, min_budget, max_budget) with RLS.

### What Was Done

- Created `supabase/migrations/003_create_budget_slots.sql`:
  - Table: `budget_slots` (id, user_id, label, days text[], start_time/end_time as `time`, min_budget/max_budget with CHECK)
  - RLS: select/insert/update/delete own slots
  - Index on `user_id`

---

## Work Order 12: API Route — CRUD Budget Slots

**Area:** Backend  
**Description:** Implement endpoints to create, update, delete, and list budget_slots for the authenticated user with validation.

### What Was Done

- **GET `/api/budget-slots`:** List slots for user, ordered by created_at
- **POST `/api/budget-slots`:** Create slot, validate with `CreateBudgetSlotSchema`
- **PATCH `/api/budget-slots/[id]`:** Update slot, validate with `UpdateBudgetSlotSchema`, enforce user_id
- **DELETE `/api/budget-slots/[id]`:** Delete own slot only
- All routes use improved error handling (JSON parse, multi-field Zod errors)

---

## Work Order 13: API Route — Get Current User Profile + Preferences

**Area:** Backend  
**Description:** Implement authenticated endpoint to fetch profile and preferences from Supabase for client hydration.

### What Was Done

- **GET `/api/profile`:** Already existed. Returns `{ profile, preferences }` with null fallbacks when records are missing
- Used by preferences settings page and future profile hydration

---

## Work Order 14: Create "Budget Slots" Onboarding Flow (UI)

**Area:** Frontend  
**Description:** UI to add/edit/delete weekly budget slots with day(s) of week, start/end time, and min/max budget.

### What Was Done

- **`/onboarding/budget-slots`:** StepIndicator (2 of 2), inline `BudgetSlotForm`, list of created slots via `BudgetSlotCard`
- "Add another slot" and "Finish setup" / "Skip for now" with navigation to `/chat`
- Each slot can be deleted before finishing

---

## Work Order 15: Budget Slot Time Picker + Day-of-Week Selector Components

**Area:** Frontend  
**Description:** UX controls for selecting time ranges and days with validation (start before end, required fields).

### What Was Done

- **`components/onboarding/DaySelector.tsx`:** Circular pill buttons for Mon–Sun with toggle selection
- **`components/onboarding/BudgetSlotForm.tsx`:** Form with label, day selector, native `<input type="time">` for start/end, min/max budget inputs
- Client-side validation: start &lt; end, max ≥ min, at least one day selected

---

## Work Order 16: Budget Slots Management Page (Post-Onboarding)

**Area:** Frontend  
**Description:** CRUD UI for budget slots after onboarding, reusing onboarding components.

### What Was Done

- **`/settings/budget-slots`:** Full CRUD:
  - Load slots via GET `/api/budget-slots`
  - Inline create form (collapsible)
  - `BudgetSlotCard` with Edit/Delete
  - Edit form pre-populated when editing
  - Toasts for create/update/delete
  - Empty state with "Create your first slot"

---

## Work Order 17: Implement SlotResolver Service (MVP Rules)

**Area:** Backend  
**Description:** Given current day/time and user's budget slots, determine the active slot. Handle edge cases (no slot, overlapping slots).

### What Was Done

- Enhanced `lib/budgets/slotResolver.ts`:
  - Uses `getCurrentDay()` and `getCurrentTime()` from `lib/utils/time.ts`
  - Fetches user's slots from Supabase
  - If multiple slots match (overlap): picks narrowest time window (most specific)
  - Returns `null` when no slot matches or user has no slots

---

## Work Order 18: API Route — Resolve Active Budget Slot for Now

**Area:** Backend  
**Description:** Endpoint that returns the active budget slot (or fallback) to support "Find Food" and chat requests.

### What Was Done

- Created **GET `/api/budget-slots/active`**
- Returns `{ slot }` — the active slot for the current authenticated user at the current time, or `null`

---

## Work Order 19: Location Permission Request + Capture Current Coordinates

**Area:** Frontend  
**Description:** Browser geolocation permission handling, user-friendly fallbacks, persist last known location for session use.

### What Was Done

- Created `lib/hooks/useLocation.ts`:
  - **`useLocation()`** returns: `{ location, status, error, requestLocation }`
  - **Status:** `idle`, `requesting`, `granted`, `denied`, `unavailable`
  - **Error messages:** Different messages for permission denied, position unavailable, timeout
  - **Caching:** Last location stored in `sessionStorage` under `foodgraph_last_location`
  - Options: `enableHighAccuracy: false`, `timeout: 10000`, `maximumAge: 300000` (5 min)

---

## Work Order 20: Build Chat Interface MVP

**Area:** Frontend  
**Description:** Chat thread UI with message list, input box, submit handling, and display of 3–5 recommendations as cards.

### What Was Done

- **`/chat` page:**
  - Empty state: "Find Food Now" button, copy explaining the feature
  - Message thread with `ChatBubble` for user and assistant
  - Assistant messages with `recommendations` render `RestaurantCard` components inline
  - Loading state: spinner + skeleton cards while waiting for response
  - Input area: text input, Send button, "Find Food" quick-action button
  - Integrates `useLocation()` — requests permission on mount, disables input until location is available
  - Calls `POST /api/chat` with `{ message, location, include_wildcard }`
  - Scrolls to bottom on new messages

---

## File Summary

### New Files Created

| Path | Purpose |
|------|---------|
| `lib/env.ts` | Environment validation (server/client) |
| `lib/supabase/auth.ts` | Server-side getUser/requireUser |
| `lib/supabase/useAuth.ts` | Client-side auth state hook |
| `lib/hooks/useLocation.ts` | Geolocation hook with session cache |
| `components/ui/Spinner.tsx` | Loading spinner |
| `components/ui/Skeleton.tsx` | Skeleton placeholder |
| `components/ui/EmptyState.tsx` | Empty state with icon, title, description, action |
| `components/ui/Badge.tsx` | Badge component |
| `components/ui/Textarea.tsx` | Textarea with label/error |
| `components/ui/Select.tsx` | Select with label/error |
| `components/ui/Toast.tsx` | ToastProvider + toast() |
| `components/chat/ChatBubble.tsx` | Chat bubble by role |
| `components/restaurants/RestaurantCardSkeleton.tsx` | Loading skeleton for cards |
| `components/layout/SignOutButton.tsx` | Sign out button |
| `components/onboarding/PreferencesForm.tsx` | Cuisine/dietary/radius form |
| `components/onboarding/DaySelector.tsx` | Day-of-week pill selector |
| `components/onboarding/BudgetSlotForm.tsx` | Budget slot create/edit form |
| `components/onboarding/BudgetSlotCard.tsx` | Budget slot display card |
| `app/(app)/layout.tsx` | Layout with Header for app routes |
| `app/api/budget-slots/active/route.ts` | Resolve active slot endpoint |
| `supabase/migrations/001_create_profiles.sql` | Profiles table + RLS |
| `supabase/migrations/002_create_user_preferences.sql` | User preferences table + RLS |
| `supabase/migrations/003_create_budget_slots.sql` | Budget slots table + RLS |

### Modified Files

| Path | Changes |
|------|---------|
| `lib/supabase/client.ts` | Use clientEnv |
| `lib/supabase/server.ts` | Use serverEnv |
| `lib/supabase/middleware.ts` | Route protection, redirect logic |
| `lib/budgets/slotResolver.ts` | Overlapping-slot handling |
| `app/layout.tsx` | ToastProvider, base styles |
| `app/(auth)/login/page.tsx` | Full login form with Supabase Auth |
| `app/(auth)/signup/page.tsx` | Full signup form |
| `app/(app)/chat/page.tsx` | Chat interface MVP |
| `app/(app)/onboarding/preferences/page.tsx` | Preferences onboarding |
| `app/(app)/onboarding/budget-slots/page.tsx` | Budget slots onboarding |
| `app/(app)/settings/preferences/page.tsx` | Preferences settings |
| `app/(app)/settings/budget-slots/page.tsx` | Budget slots CRUD settings |
| `app/api/profile/route.ts` | Error handling, PUT upsert |
| `app/api/budget-slots/route.ts` | Error handling |
| `app/api/budget-slots/[id]/route.ts` | Error handling |
| `components/layout/Header.tsx` | SignOutButton, updated nav links |

---

## Running Migrations

Apply the database migrations in order:

1. `001_create_profiles.sql`
2. `002_create_user_preferences.sql`
3. `003_create_budget_slots.sql`

You can run these in the **Supabase Dashboard → SQL Editor** or via CLI:

```bash
supabase db push
```

---

## Environment Variables

Required in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (client-safe)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only)
- `GOOGLE_PLACES_API_KEY` — For restaurant provider (WO21)

---

## Work Order 21: Implement restaurantProvider (Google Places API)

**Area:** Backend  
**Description:** Integrate external restaurant API to fetch nearby open restaurants given lat/lng + radius, including pricing/rating when available.

### What Was Done

- Rewrote `lib/restaurants/restaurantProvider.ts` to call Google Places API (New) `searchNearby` endpoint
- Request fields: displayName, formattedAddress, location, priceLevel, rating, userRatingCount, types, currentOpeningHours, photos
- Maps Google price levels to `$`/`$$`/`$$$`/`$$$$` and estimates avg_price_per_person
- Computes distance from user via Haversine
- Extracts cuisine types from place types (filtering out generic types)
- Constructs photo URLs from photo references
- Gracefully returns empty array if API key is not configured or API returns error

---

## Work Order 22: Implement Restaurant Filtering (Budget, Open Now, Radius, Dietary)

**Area:** Backend  
**Description:** Filter candidate restaurants by travel radius, open status, budget range; apply dietary restrictions best-effort.

### What Was Done

- Enhanced `lib/restaurants/filters.ts`:
  - **Open now:** Filters out restaurants where `is_open_now === false` (keeps `null` / unknown)
  - **Budget:** 20% tolerance on both ends (e.g. $10–$30 slot accepts $8–$36) to avoid over-filtering
  - **Distance:** Hard cutoff at `maxDistanceKm`
  - **Dietary:** Filters only against restaurants that have tag data; keeps untagged restaurants (best-effort)
  - Strips "none" from dietary restrictions before filtering

---

## Work Order 23: Implement recommendationScorer (Deterministic Scoring)

**Area:** Backend  
**Description:** Score restaurants using budget fit, cuisine match, distance, rating, and lightweight preference boosts.

### What Was Done

- Rewrote `lib/scoring/recommendationScorer.ts` with weighted scoring:
  - **Budget fit (30%):** Deviation from budget slot midpoint relative to range
  - **Cuisine match (25%):** Matches user cuisine prefs and personalization history
  - **Distance (20%):** Tiered scoring (≤0.5km = 1.0, ≤1km = 0.9, ≤3km = 0.7, etc.)
  - **Rating (15%):** Normalized 0–1 from 5-star scale
  - **Personalization (10%):** Boosts for historical price/cuisine alignment
- All scores rounded to 2 decimal places
- Returns top N results sorted by total score

---

## Work Order 24: Implement chatOrchestrator Workflow

**Area:** AI  
**Description:** Wire a flow that accepts user query, calls slotResolver + restaurantProvider + scorer, and produces structured response.

### What Was Done

- Rewrote `lib/chat/chatOrchestrator.ts` with full pipeline:
  1. Parallel fetch: active budget slot + user preferences + personalization hints
  2. Fetch nearby restaurants via cache-backed provider
  3. Filter by budget/distance/dietary/open-now
  4. Score and rank
  5. Optionally select wildcard
  6. Generate explanations for each result
  7. Track recommendation event in database
  8. Return structured ChatResponse
- Handles edge cases with user-friendly messages: no restaurants found, no matches after filtering, no budget slot

---

## Work Order 25: LLM Prompt + Response Schema for Chat Explanations

**Area:** AI  
**Description:** Create prompts that explain "why these picks" using computed results without re-ranking. Enforce structured JSON output.

### What Was Done

- Created `lib/chat/explanationPrompt.ts`:
  - **`ExplanationResponseSchema`:** Zod schema for `{ explanations: [{ place_id, explanation }] }`
  - **`buildExplanationPrompt()`:** Constructs an LLM prompt with restaurant data, scores, and budget context — instructs the model not to re-rank
  - **`generateFallbackExplanations()`:** Deterministic explanation generator used when no LLM is available — produces human-readable explanations from score data (budget fit, cuisine match, rating, distance, wildcard status)
- The fallback generator is used by default; the prompt is ready for LLM integration when a provider is added

---

## Work Order 26: API Route — Chat Recommendation Request

**Area:** Backend  
**Description:** Endpoint that takes user message + location, runs the orchestrator, and returns structured recommendations.

### What Was Done

- Enhanced `app/api/chat/route.ts`:
  - JSON parse error handling
  - Multi-field Zod validation errors
  - Try/catch around orchestrator with user-friendly 500 error
- Enhanced `app/api/recommendations/route.ts`:
  - Same error handling improvements
  - Wired in personalization hints, explanation generation, and event tracking
  - Returns `recommendation_event_id` for frontend action tracking

---

## Work Order 27: Frontend Rendering of Recommendations + "Why" Explanations

**Area:** Frontend  
**Description:** Display restaurant cards with key info and explanation blurb from the orchestrator.

### What Was Done

- `RestaurantCard` already renders name, address, price, rating, distance, and explanation text
- Chat page now renders `RestaurantCard` for each recommendation in assistant messages
- Explanations are generated server-side and included in the `explanation` field of each `ScoredRecommendation`
- Wildcard picks display with amber border and "Wildcard" badge

---

## Work Order 28: Add "Find Food" Quick Action Entry Point

**Area:** Frontend  
**Description:** Add a prominent button that launches a recommendation request using current context.

### What Was Done

- Chat page empty state features a large "Find Food Now" button
- Below it: "or surprise me with a Wildcard" link
- After first message, "Find Food" button remains in the input bar
- Both actions use current location automatically

---

## Work Order 29: Error Handling + User-Friendly Fallbacks

**Area:** Frontend  
**Description:** Handle "no location," "no restaurants found," "API down," and "no active budget slot" cases.

### What Was Done

- **No location (denied):** Shows error message and "Try again" button
- **No location (unavailable):** Shows device-specific error
- **Location pending:** Shows spinner with "Getting your location" text
- **No restaurants found:** Orchestrator returns friendly message suggesting radius increase
- **No matches after filtering:** Message referencing active budget slot and suggesting adjustments
- **API error:** Try/catch in chat route returns 500 with user-friendly message
- **Network failure:** Client-side catch displays error in chat bubble
- Input is disabled until location is available; placeholder text changes based on location status

---

## Work Order 30: Track Recommendation Events on Generation

**Area:** Backend  
**Description:** When recommendations are returned, write a recommendation_events record.

### What Was Done

- Created `lib/chat/trackRecommendation.ts`:
  - `trackRecommendationEvent()` inserts into `recommendation_events` table
  - Stores: user_id, slot_id, location_lat/lng, results (place_id, name, score, is_wildcard as JSONB), candidate_count, filters_applied
  - Returns event ID for frontend action tracking
  - Non-blocking: failure is logged but doesn't break the response
- Integrated into both `chatOrchestrator` and `/api/recommendations` route
- Frontend stores `lastEventId` and passes it to `/api/user-actions` on card select

---

## Work Order 31: Database — Create recommendation_events Table

**Area:** Database  
**Description:** Store each recommendation response payload for analytics/personalization.

### What Was Done

- Created `supabase/migrations/004_create_recommendation_events.sql`:
  - Table: `recommendation_events` (id, user_id, slot_id, location_lat/lng, results JSONB, candidate_count, filters_applied JSONB, created_at)
  - Indexes on user_id and created_at
  - RLS: users can read and insert own events
  - slot_id references budget_slots with ON DELETE SET NULL

---

## Work Order 32 – Database: create user_actions table

**Sequence:** 32 | **Category:** Database

**Description:** Log clicks and selections of recommended restaurants (and wildcard usage) to support behavior tracking.

### What Was Done

- Created `supabase/migrations/005_create_user_actions.sql`:
  - Table: `user_actions` (id, user_id, recommendation_event_id, restaurant_place_id, action_type, metadata JSONB, created_at)
  - `action_type` constrained to: click, select, wildcard_request, wildcard_select, dismiss
  - Foreign keys to auth.users and recommendation_events with ON DELETE CASCADE
  - Indexes on user_id, recommendation_event_id, and created_at
  - RLS: users can read and insert own actions

---

## Work Order 33 – API route: Log user action events

**Sequence:** 33 | **Category:** Backend

**Description:** Authenticated endpoint for recording click/select actions with related recommendation_event id.

### What Was Done

- Enhanced `app/api/user-actions/route.ts`:
  - POST endpoint validates auth, parses JSON with safe error handling, validates via `CreateUserActionSchema`
  - Zod validation errors now return path-specific messages (e.g., `"action_type: Invalid value"`)
  - Inserts row into `user_actions` with user_id from session
  - Returns the created action (201) or structured error response

---

## Work Order 34 – Track user actions (frontend)

**Sequence:** 34 | **Category:** Frontend

**Description:** Instrument UI events and create endpoint(s) to record actions into user_actions.

### What Was Done

- Created `lib/hooks/useTrackAction.ts` — fire-and-forget helper that POSTs to `/api/user-actions`. Non-blocking, catches errors silently.
- Updated `app/(app)/chat/page.tsx`:
  - `handleCardClick(rec)` fires a `click` event when the card body is tapped
  - `handleCardSelect(rec)` fires `select` or `wildcard_select` on the explicit Select button
  - `handleWildcard()` fires a `wildcard_request` event before sending the API call
- Updated `components/restaurants/RestaurantCard.tsx`:
  - Added `onClick` prop (tracks clicks) separate from `onSelect` (tracks explicit selection)
  - Select renders as an explicit button within the card that prevents event propagation

---

## Work Order 35 – Performance budget + latency instrumentation

**Sequence:** 35 | **Category:** Infrastructure

**Description:** Add timing metrics around provider calls, scoring, and total request time; log slow requests and ensure under-3s target is measurable.

### What Was Done

- Created `lib/utils/perf.ts`:
  - `PerfTimer` class with `measure(label, fn)` to wrap async operations
  - `finish()` returns total elapsed time, per-step breakdown, and `slow` flag (> 3000ms)
  - Slow requests are logged with `console.warn` including all step timings
  - Development mode logs all timings for debugging
- Instrumented `lib/chat/chatOrchestrator.ts`:
  - `context_fetch` — measures slot + preferences + personalization resolution
  - `restaurant_search` — measures the cached/uncached restaurant provider call
  - `scoring` — measures the recommendation scoring step
  - `timer.finish()` at end of pipeline logs total latency and flags slow requests

---

## Work Order 36 – Database: create restaurant_cache table

**Sequence:** 36 | **Category:** Database

**Description:** Cache restaurant results keyed by geohash/cell + query params + timestamp; define access rules.

### What Was Done

- Created `supabase/migrations/006_create_restaurant_cache.sql`:
  - Table: `restaurant_cache` (id, cache_key UNIQUE, data JSONB, fetched_at, expires_at)
  - Indexes on cache_key and expires_at
  - RLS enabled, no user-level policies — service role only access
  - Designed for server-side read-through caching

---

## Work Order 37 – Caching layer for restaurant queries

**Sequence:** 37 | **Category:** Backend

**Description:** Implement read-through cache using restaurant_cache to reduce external API calls and improve latency; define TTL strategy.

### What Was Done

- Created `lib/utils/geohash.ts`:
  - Pure function `encodeGeohash(lat, lng, precision)` generates a geohash string for spatial bucketing
  - Default precision 5 (~5km cells) matches typical search radius
- Rewrote `lib/restaurants/restaurantCache.ts`:
  - `buildCacheKey` combines geohash + radius bucket for deterministic keys
  - Read-through pattern: check cache first → on miss, call provider → write result back
  - TTL: 1 hour (`CACHE_TTL_MS`), compared against `expires_at` column
  - Uses `upsert` with `onConflict: "cache_key"` for idempotent writes
  - Gracefully degrades: cache miss or table errors fall through to live API call

---

## Work Order 38 – Basic personalization hints (MVP)

**Sequence:** 38 | **Category:** Backend

**Description:** Add simple boosts based on historical user_actions. Keep logic deterministic.

### What Was Done

- Rewrote `lib/personalization/personalizationEngine.ts`:
  - `getPersonalizationHints(userId)` queries the last 100 user_actions and joins with recommendation_events
  - `deriveHintsFromActions(actions, eventMap)` computes:
    - `preferred_cuisines` — top 5 cuisines by selection frequency (from action metadata)
    - `avg_selected_price` — rolling average of price points from selected restaurants
    - `wildcard_acceptance_rate` — ratio of wildcard_select to wildcard_request events
  - Fully deterministic — no ML or randomness
  - Graceful fallback: returns empty hints on any error

---

## Work Order 39 – Implement wildcardEngine (MVP heuristic)

**Sequence:** 39 | **Category:** Backend

**Description:** Select a high-quality candidate slightly outside usual cuisine preferences while staying within reasonable distance and acceptable budget bounds.

### What Was Done

- Rewrote `lib/wildcard/wildcardEngine.ts`:
  - Filters out already-recommended restaurants
  - Scores remaining candidates with a multi-factor heuristic:
    - **Outside user cuisine prefs** (+3) — the core "surprise" factor
    - **High rating** (+4 for ≥4.5, +3 for ≥4.0, +1 for ≥3.5) — quality floor
    - **Close distance** (+2 for ≤2km, +1 for ≤5km) — reasonable proximity
    - **Affordable** (+1 if ≤$50/person) — budget sanity check
    - **Good review count** (+1 if ≥50 reviews) — quality signal tiebreaker
  - Sorts by composite score, then by rating as tiebreaker
  - Returns top pick as `ScoredRecommendation` with `is_wildcard: true`

---

## Work Order 40 – Add "Wildcard" UI affordance

**Sequence:** 40 | **Category:** Frontend

**Description:** Add a "Wildcard" button/toggle in chat results that requests a wildcard recommendation and renders it distinctly.

### What Was Done

- Updated `app/(app)/chat/page.tsx`:
  - Persistent "Wildcard" button in the input bar (appears after first message alongside "Find Food")
  - Styled with amber border/background matching the wildcard theme
  - Disabled during loading or when location is unavailable
  - "or surprise me with a Wildcard" link retained in the empty state
  - Triggers `handleWildcard()` which sends `include_wildcard: true` to the API
- Wildcard restaurant cards continue to render with amber border and "Wildcard" badge via `RestaurantCard`
