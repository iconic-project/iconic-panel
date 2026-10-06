# iconic-panel

Staff SPA for the Iconic hotel. **RMS** and **CRM** live in one Nuxt 4 app. The URL decides the section (`/rms/…` vs `/crm/…`). Inventory is rooms and nights. Both sides call the same `useApi()` from the `iconic-ui` layer.

| | |
|---|---|
| Port | **3001** |
| Render | SPA (`ssr: false`) |
| Layer | local `../iconic-ui`; Netlify `github:iconic-project/iconic-ui#dev` |
| API | `NUXT_PUBLIC_API_BASE` (default `http://localhost:8000`) |

The API must already allow this origin. CORS is configured on the API via `FRONTEND_PANEL_URL=http://localhost:3001`.

## Setup

```bash
pnpm install
cp .env.example .env
```

`.env`:

```
NUXT_PUBLIC_API_BASE=http://localhost:8000
```

## Run

From the Cursor workspace, use **Iconic: start everything** — it starts the API and `pnpm dev --port 3001` for this app.

Or locally:

```bash
pnpm dev
```

Open `http://localhost:3001`. `/` redirects to the RMS calendar. `/crm` and `/crm/pipeline` redirect to the CRM pipeline.

## Structure

```
app/
  layouts/default.vue     aside + header (section switch, account menu, theme)
  pages/rms/…             RMS routes under /rms
  pages/crm/…             CRM routes under /crm
  navigation/rms.ts       RMS sidebar tree
  navigation/crm.ts       CRM sidebar tree
  sections.ts             section registry (homes, brand subtitles)
  composables/useSystem.ts  current section = route prefix; last path in localStorage
  components/shell/       SectionSwitch, PlaceholderPage
i18n/locales/en.json      panel chrome + nav labels (merged with the layer’s theme.* keys)
```

One codebase, one `useApi()`. CRM screens never call booking, payment, refund, commission, document or pricing mutations.

## Deploy (Netlify)

`netlify.toml` owns the build command (`pnpm generate`) and publish directory (`.output/public`). Do not set those in the Netlify UI. Set `NUXT_PUBLIC_API_BASE` in the site env.

Staff login is Sanctum cookies. Use a custom domain under the same parent as the API (`SESSION_DOMAIN=.yourdomain.com`). A `*.netlify.app` origin will not keep the session with the default `SameSite=lax` cookie.

The API must allow this origin: `FRONTEND_PANEL_URL`, plus the host in `SANCTUM_STATEFUL_DOMAINS`.

## Quality

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm generate
```
