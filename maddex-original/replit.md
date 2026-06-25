# MADDEX — Powered by MaddenAI

Mobile-first financial intelligence app for everyday Australians by Madden Group.

## Stack
- **Frontend**: React + TypeScript (Vite), single-file app at `client/src/App.tsx`
- **Backend**: Express server at `server/`
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`) via `VITE_ANTHROPIC_API_KEY`
- **Market data**: Alpha Vantage (`VITE_ALPHA_VANTAGE_KEY`) + Yahoo Finance + CoinGecko
- **Auth**: JWT (bcryptjs hashing, 30-day tokens stored in `localStorage` as `maddex_token`)
- **Database**: Replit PostgreSQL (via `DATABASE_URL`)

## Key Files
- `client/src/App.tsx` — main app (all screens and components)
- `client/src/maddex_auth.js` — JWT auth + portfolio/watchlist/profile CRUD (fetch API)
- `client/src/maddenAI_resolver.js` — Claude AI integration + market data orchestration
- `client/src/maddenAI_engine.js` — Alpha Vantage/Yahoo Finance/CoinGecko fetchers
- `client/src/maddenAI_scoring.js` — market sentiment scoring engine
- `client/src/maddenAI_personalisation.js` — user context builder for AI prompts
- `server/routes.ts` — all API routes (auth, profile, portfolio, watchlist, news, charts)
- `server/db.ts` — PostgreSQL connection pool
- `server/auth.ts` — JWT sign/verify + `requireAuth` middleware
- `shared/schema.ts` — Drizzle schema for all 4 tables

## Database Schema (Replit PostgreSQL)
Four tables managed via Drizzle (`npm run db:push`):

| Table | Purpose |
|---|---|
| `users` | id, email, password_hash, first_name, last_name, full_name, country, avatar_url, deleted_at |
| `user_profiles` | id (FK→users), knowledge_level, risk_profile, income_bracket, goals, life_stage, subscription_tier, newsletter_enabled, avatar_url |
| `portfolio_items` | id, user_id (FK→users), asset_symbol, asset_name, asset_type, asset_sector, shares |
| `watchlist_items` | id, user_id (FK→users), asset_symbol, asset_name, asset_type, asset_sector |

## API Routes
- `POST /api/auth/signup` — register, returns JWT + user
- `POST /api/auth/login` — authenticate, returns JWT + user
- `GET  /api/auth/me` — verify token, returns user (requires auth)
- `POST /api/auth/update-email` — change email (requires auth)
- `POST /api/auth/update-password` — change password (requires auth)
- `GET/PUT /api/profile/:userId` — get/update profile (requires auth)
- `POST /api/profile/:userId/avatar` — upload avatar as base64 (requires auth)
- `DELETE /api/profile/:userId` — soft-delete account (requires auth)
- `GET/POST /api/portfolio/:userId` — list/add portfolio items (requires auth)
- `PATCH/DELETE /api/portfolio/item/:id` — update/remove item (requires auth)
- `GET/POST /api/watchlist/:userId` — list/add watchlist items (requires auth)
- `DELETE /api/watchlist/item/:id` — remove watchlist item (requires auth)

## Screens / Tabs (bottom nav)
1. **Portfolio** — holdings & watchlist with live prices
2. **Trends** — Market indices, sector strength, crypto momentum
3. **Home** (center) — AI Signal Banner + market overview
4. **News** — Market news feed with AI sentiment
5. **AI Chat** — MaddenAI chat with structured response cards
6. **Account** — User profile, preferences, sign out

## Auth Flow
- JWT stored in `localStorage` as `maddex_token`
- Login screen shown when no valid token exists
- `onAuthChange` listener keeps session state in sync
- `getSession()` verifies token against `/api/auth/me` on app load
- Immediate signup — no email verification required

## Auth Features
- Stale session: `getSession()` calls `/api/auth/me` on app load; expired/invalid tokens are cleared and user is signed out
- Account deletion: soft-deletes (sets `deleted_at`) + removes portfolio/watchlist data; token cleared and user signed out

## Design System
- Dark theme: `#0B1222` background, `#111827` cards
- Accent blue: `#287BFF`, Gold: `#F5A623`
- Fonts: Syne (headings/brand), Space Grotesk (numbers)
- All styles in `S` object (inline styles) and `C` design tokens

## User Preferences
- Keep all styles inline (no Tailwind in App.tsx — pure inline style objects)
- Mobile-first layout (max-width ~430px centered)
- AI brand name: MaddenAI (never "Claude" or "Anthropic" in UI)

## Environment Secrets Required
- `VITE_ANTHROPIC_API_KEY` — Claude API key (set in Replit Secrets)
- `JWT_SECRET` — for production; defaults to dev secret if not set
- `DATABASE_URL` — auto-set by Replit PostgreSQL integration
