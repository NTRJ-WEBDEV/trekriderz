# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is TrekRiderz

India's first social trekking platform. Connects travelers with verified local guides and homestays, enables group trip planning, and hosts a community social feed. The primary product is an Android app (distributed as APK); the web app is a marketing landing page + public expedition browser + admin panel.

## Commands

### Mobile (React Native + Expo SDK 54)
```bash
cd mobile
npm install
npm start            # Expo dev server (scan QR in Expo Go)
npm run android      # Launch on Android emulator/device
npm run ios          # Launch on iOS simulator (macOS only)
```

### Web (Next.js 15)
```bash
cd web
npm install
npm run dev          # Dev server at localhost:3000
npm run build
npm start
```

### Database
All schema changes are SQL files in the repo root (`supabase_*.sql`, `guided_expeditions_migration.sql`, etc.). Apply them in Supabase SQL Editor. The canonical full schema is `supabase/complete_schema_combined.sql`.

## Environment Setup

Copy `.env.example` to `.env` in both `mobile/` and `web/` directories.

**Mobile** (`mobile/.env`):
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase project credentials
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — for maps
- `EXPO_PUBLIC_RAZORPAY_KEY_ID` — payment gateway (Razorpay)
- `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` — AI features

**Web** (`web/.env`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APK_URL` — served APK download link

## Architecture

### Repository Layout
```
trekriderz/
├── mobile/          # React Native app — the primary product
│   ├── app/         # Expo Router file-based pages
│   ├── components/  # Shared UI (SocialPost, ExpeditionCard, etc.)
│   ├── lib/         # Service modules (supabase, geocoding, payment, etc.)
│   ├── stores/      # Zustand stores (authStore, expeditionStore)
│   └── services/    # Background tasks (background-location, sync-service)
├── web/             # Next.js marketing site + admin
│   ├── app/         # App Router pages + API routes
│   └── lib/         # Supabase SSR client, payment helper
├── pages/           # Legacy Next.js pages (privacy.js, terms.js)
└── supabase/        # Supabase project config + combined schema
```

### Mobile Navigation (Expo Router)
The root layout (`mobile/app/_layout.tsx`) wraps everything in `QueryClientProvider`. Auth state is checked via `useAuthStore.init()` on mount. Unauthenticated users hit `login` / `signup` / `onboarding`. Authenticated users land in `(tabs)/` which has five bottom tabs: Home, Create, Explore, Notifications, Profile.

Dynamic routes follow `[id]` / `[tripId]` patterns — e.g., `/trip/[id]`, `/chat/[tripId]`, `/expeditions/[id]`.

### State Management
- **Zustand** (`mobile/stores/`): `useAuthStore` for session/user (initialized once at root); `useExpeditionStore` for expeditions list + active expedition + bookings
- **Local `useState`**: used directly in screens for most page-level data
- **React Query**: imported but not used consistently — most screens query Supabase directly

### Supabase Integration
- Mobile: `mobile/lib/supabase.ts` — standard `createClient` with AsyncStorage session persistence
- Web: `web/lib/supabase.ts` — `@supabase/ssr` client for Next.js

Realtime channels are opened in the root layout for per-user notification inserts (`notifications:{user_id}`). Chat uses its own channel per trip.

### Offline Support
`mobile/lib/db.ts` wraps `expo-sqlite` with two tables:
- `trips` — read cache for offline browsing
- `pending_tasks` — write queue (operation + table + JSON payload)

`mobile/services/sync-service.ts` drains the queue when connectivity is restored. Use `queueTask()` from `lib/db.ts` instead of direct Supabase writes for any mutation that needs offline tolerance.

### Key Database Tables
| Table | Purpose |
|---|---|
| `users` | Extends `auth.users`; roles: `user`, `homestay_owner`, `guide`, `admin` |
| `trips` | Trip plans; `itinerary`, `packing_list`, `safety_checklist` stored as JSONB |
| `trip_members` | Many-to-many trips↔users with organizer/member roles |
| `homestays` | Listings with approval workflow: `pending → approved/rejected/suspended` |
| `guides` | Guide profiles + `is_premium` flag gating expedition creation |
| `guided_expeditions` | Guide-hosted expeditions with seat management and waitlist |
| `expedition_packages` | 1–3 pricing tiers per expedition |
| `expedition_itinerary_days` | Day-by-day itinerary for expeditions |
| `posts` | Social feed posts with likes/comments |
| `notifications` | In-app notifications, used with Supabase Realtime |

Row Level Security is enabled on all tables. Admins bypass via service role key only in backend contexts.

### Payment Flow
Razorpay is the payment gateway (`EXPO_PUBLIC_RAZORPAY_KEY_ID`). The web API route `web/app/api/payments/create-order/route.ts` is currently in **offline mode** — it returns a mock order ID. The actual Razorpay order creation is disabled.

### Web App Scope
The web app (`web/`) is intentionally lightweight:
- `/` — marketing landing page (no framework overhead, inline styles)
- `/expeditions` + `/expeditions/[id]` — public expedition browser
- `/admin` — admin panel for verifying guides/homestays
- `/api/payments/*` — API routes for payment flow

The web app does **not** replicate trip planning or social features — those are mobile-only.

### Design System
- **Mobile background**: `#080C14` (dark navy), cards: `rgba(255,255,255,0.05)` glassmorphism
- **Mobile accent**: Green `#8CC63F`
- **Web background**: `#0A0E27`, accent: Orange `#F97316`
- Icons: `@expo/vector-icons` (Ionicons) throughout mobile

### Deployment
- Mobile: EAS Build (`mobile/eas.json`) → Google Play Store
- Web: Vercel (`vercel.json` at root)
