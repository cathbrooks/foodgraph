# MVP build Roadmap

### Scope

Build the MVP described in the PRD: accounts, onboarding (budgets + preferences), location-based restaurant search, deterministic recommendation engine, chat UI, wildcard option, and behavior tracking.

### Build order (40 work orders)

| Order | Work order | Area | Description |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Repo + Next.js (TypeScript) bootstrap | Frontend | Create Next.js app, set up App Router, linting, formatting, and env conventions. | 2 | Supabase project setup | Infrastructure | Create Supabase project, configure env vars, and define local dev workflow. |
| 3 | Auth integration (Supabase Auth) | Backend | Implement session handling for server + client and protect authenticated routes. | 4 | Database schema: profiles | Database | Create `profiles` table keyed by auth user id. Enable RLS and per-user policies. |
| 5 | Database schema: user_preferences | Database | Create `user_preferences` (cuisines, restrictions, travel radius). Enable RLS and policies. | 6 | Database schema: budget_slots | Database | Create `budget_slots` (days, start/end, min/max budgets). Enable RLS and policies. |
| 7 | Database schema: recommendation_events | Database | Create `recommendation_events` to store generated results and request context. | 8 | Database schema: user_actions | Database | Create `user_actions` for clicks, selections, and wildcard usage. |
| 9 | Database schema: restaurant_cache | Database | Create cache table and TTL strategy. Add indexes and service-role write access. | 10 | Shared TypeScript types + Zod validation | Backend | Define types/schemas for preferences, slots, location, restaurants, and API responses. |
| 11 | API: GET /api/me | Backend | Return current profile + preferences for app hydration. | 12 | API: GET/PUT /api/preferences | Backend | Upsert preferences with validation and auth checks. |
| 13 | API: GET/POST /api/budget-slots | Backend | Create and list budget slots for the current user. | 14 | API: PATCH/DELETE /api/budget-slots/[id] | Backend | Edit and delete budget slots with per-user enforcement. |
| 15 | slotResolver service | Backend | Resolve active budget slot based on day/time. Define fallback behavior if no slot matches. | 16 | API: GET /api/slot/active | Backend | Expose active budget slot resolution to the UI. |
| 17 | Restaurant provider integration | Backend | Integrate Google Places API or Yelp API and normalize a restaurant model. | 18 | Restaurant caching layer | Backend | Implement read-through cache using `restaurant_cache` to reduce external calls. |
| 19 | Location + radius filtering | Backend | Filter candidates by travel radius and open hours using provider fields. | 20 | Budget filtering rules | Backend | Apply active slot min/max budgets. Define behavior when pricing data is missing. |
| 21 | Dietary restriction filtering (best effort) | Backend | Implement minimal restriction handling using available tags/metadata from providers. | 22 | Recommendation scoring (deterministic) | Backend | Score by budget fit, cuisine match, distance, and rating. Return top 3–5. |
| 23 | Wildcard selection logic | Backend | Select a surprise option slightly outside normal preferences while staying reasonable. | 24 | LangGraph project scaffolding | AI | Set up LangGraph workflow package and conventions for orchestration. |
| 25 | chatOrchestrator graph (MVP) | AI | Graph pipeline: slotResolver → provider → filters → scorer → wildcard (optional). | 26 | LLM prompt + structured output contract | AI | Generate explanations and response copy without re-ranking. Enforce JSON schema. |
| 27 | API: POST /api/chat/recommend | Backend | Accept message + location. Run orchestrator. Return structured recommendations. | 28 | Persist recommendation_events | Backend | Write one event per response with context (slot, filters applied, candidate counts). |
| 29 | API: POST /api/actions | Backend | Record user action events tied to a recommendation_event id. | 30 | UI component kit | Frontend | Buttons/inputs/cards/toasts/loading states. Chat bubble + restaurant card components. |
| 31 | Auth screens | Frontend | Signup/login/logout UI. Redirect logic based on session state. | 32 | Onboarding: preferences | Frontend | Cuisines, restrictions, radius flow. Save to `/api/preferences`. |
| 33 | Onboarding: budget slots | Frontend | Create/edit/delete slots. Save via budget slots APIs. Basic overlap warnings. | 34 | Settings: preferences | Frontend | Edit preferences post-onboarding. Hydrate from `/api/me`. |
| 35 | Settings: budget slots | Frontend | Manage slots post-onboarding with consistent sorting and UX. | 36 | Geolocation capture + fallbacks | Frontend | Request location permission, store last known, and handle permission denied. |
| 37 | Chat UI (thread + send) | Frontend | Send to `/api/chat/recommend`. Render 3–5 results and explanations. | 38 | Wildcard UX | Frontend | Request wildcard and render highlighted result. Log wildcard usage. |
| 39 | Event tracking in UI | Frontend | Log restaurant card click/select actions to `/api/actions`. | 40 | Performance + reliability pass | Infrastructure | Add latency instrumentation, timeouts/retries, and verify under-3s target with graceful fallbacks. |

<aside>
✅

This roadmap is ordered to unblock dependencies early: auth + schema → APIs → recommendation pipeline → LangGraph orchestration → UI + tracking → performance hardening.

</aside>