# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint with Next.js plugin
npm run build:mobile # Build for iOS/Android (static export + Capacitor sync)
npm run open:ios     # Open Xcode
npm run open:android # Open Android Studio
```

There is no test runner configured — testing is manual.

## Environment Setup

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=   # optional, for native maps
NEXT_PUBLIC_API_BASE_URL=      # optional, for native API calls
```

## Architecture

Foodgraph is a conversational restaurant recommendation app. The core flow is:

```
POST /api/chat
  → chatOrchestrator.ts        # builds initial RecommendationState
  → LangGraph StateGraph        # orchestrates recommendation pipeline
  → ChatResponse
  → Zustand chatStore (client)
```

### LangGraph Recommendation Pipeline (`lib/graph/`)

The graph is a `StateGraph<RecommendationState>` defined in `recommendationGraph.ts`. Nodes execute in sequence with conditional routing:

1. **interpretIntent** — LLM (gpt-4o) classifies user message: `recommend`, `refine`, `followup`, `place_lookup`, or `chitchat`. Extracts constraints (cuisine, budget, distance, dietary).
2. **resolveContext** — Loads user preferences, active budget slot, and personalization hints from Supabase.
3. **fetchRestaurants** — Queries Google Places Text/Nearby Search with geohash-based caching via Supabase.
4. **filterAndScore** — Runs filter pipeline (budget, cuisine, distance, dietary, open-now) then deterministic weighted scoring.
5. **selectWildcard** — Optionally picks a surprise result outside user preferences.
6. **generateExplanations** — LLM (gpt-4o-mini) writes natural language "why" explanations per restaurant.
7. **trackAndRespond** — Saves `recommendation_event` to Supabase, returns `ChatResponse`.

Alternate paths: `handleFollowup` (non-recommendation intents), `lookupRestaurantDetails` (place detail requests), `earlyExit` (errors/empty results).

### Key Directories

| Path | Purpose |
|------|---------|
| `app/api/chat/` | Main API route + classify/budget-prompt/welcome-chips sub-routes |
| `lib/graph/nodes/` | One file per graph node |
| `lib/graph/edges/` | Conditional routing logic |
| `lib/restaurants/` | Google Places client, caching, filter pipeline |
| `lib/scoring/` | Weighted composite scoring algorithm |
| `lib/personalization/` | Behavior-derived recommendation hints |
| `lib/stores/chatStore.ts` | Zustand store with sessionStorage persistence |
| `lib/supabase/` | Client (browser), server (RSC/API routes), middleware |
| `types/` | Shared TypeScript types; Zod schemas for LLM outputs in `lib/ai/schemas/` |
| `supabase/migrations/` | Full database schema |

### Data Model

- **budget_slots** — Time-based per-user budget ranges (day + start/end time + min/max $)
- **recommendation_events** — Full analytics log of every recommendation
- **user_actions** — Click/select/wildcard behavior tracking (drives personalization)
- **restaurant_cache** / **google_place_details_cache** — Read-through Supabase caches with TTL

All tables use Supabase RLS for per-user isolation.

### Mobile (Capacitor)

`CAPACITOR_BUILD=true` switches Next.js to static export mode (`out/`). The `lib/platform.ts` and `lib/api.ts` utilities handle web vs. native differences (e.g., API base URL, geolocation permissions). Google Maps and Geolocation are Capacitor plugins.

### AI Clients

- `lib/ai/client.ts` — OpenAI client initialization
- `lib/ai/prompts/` — System prompts for intent parsing and explanations
- `lib/ai/schemas/` — Zod schemas used to validate/parse LLM structured outputs
- `lib/ai/timeout.ts` — Wrapper that enforces LLM call timeouts

### Path Aliases

`@/*` maps to the repository root (configured in `tsconfig.json`).
