# JellyByte Web

AI-powered browser agent interface. Chat with an AI agent that controls a remote browser, with a live screencast streamed back to your viewport.

## Setup

```bash
# Install dependencies
bun install

# Copy env file and fill in your Supabase credentials
cp .env.example .env
```

### Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `NUXT_PUBLIC_SERVER_URL` - Agent backend URL (default: `http://localhost:8000`)

Optional (for bug report feature):
- `NUXT_RESEND_API_KEY` - Resend API key for email functionality
- `NUXT_BUG_REPORT_FROM` - Verified sender email (e.g., `Jellybyte <bugs@yourdomain.com>`)
- `NUXT_BUG_REPORT_TO` - Recipient email for bug reports (default: `team@jellybyte.io`)

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Enable Google OAuth in Authentication > Providers
3. Copy your project URL and anon key to `.env`
4. (Optional) Run `supabase/migrations/20260327_create_user_memory_bucket.sql` for agent memory storage
5. Run `supabase/migrations/20260327120000_create_user_locations.sql` to store each user's latest geolocation snapshot
6. (Optional) Run `supabase/migrations/20260327_vault_rpc.sql` for secure password storage

## Development

```bash
bun run dev
```

Opens [http://localhost:3000](http://localhost:3000).

## Project structure

```
JellyByte-Web/
├── app/
│   ├── pages/
│   │   └── index.vue              Main layout: chat + browser viewport
│   ├── components/
│   │   ├── AgentActivity.vue       AI agent messages with tool calls
│   │   ├── Authenticator.s.vue     Authentication modal (login/signup)
│   │   ├── BrowserControls.vue     Address bar and nav buttons
│   │   ├── BrowserViewport.vue      Live screencast display
│   │   ├── BugReportButton.vue     Bug report submission
│   │   ├── ChatInput.vue           Chat input with send/stop
│   │   ├── ChatPanel.vue           Chat thread display
│   │   ├── DashboardPanel.vue      Workflow management dashboard
│   │   ├── HyprlandTilingDemo.vue  Hyprland-style tiling animations
│   │   ├── ProfilePanel.vue         User profile management
│   │   ├── SearchModal.vue          Fuzzy search over chat history
│   │   ├── SettingsModal.vue        Profile and auth settings
│   │   ├── SidePanel.vue            Sidebar with nav and chat history
│   │   ├── TaskFeedbackModal.vue    Beta feedback collection
│   │   ├── VaultModal.vue           Vault modal wrapper
│   │   ├── VaultPanel.vue           File manager panel
│   │   ├── WorkflowPanel.vue        Workflow execution panel
│   │   └── AuthenticationsPanel.vue Credentials/password manager
│   ├── composables/
│   │   ├── useApiVersion.ts         Backend API version checking
│   │   ├── useAuthentications.ts    Credentials management
│   │   ├── useChatLocalPersistence.ts Chat state persistence
│   │   ├── useOpenCodeAgent.ts      Core agent communication (SSE)
│   │   ├── useScreencast.ts         Screencast WebSocket
│   │   ├── useSettings.ts           User profile/preferences
│   │   ├── useUserLocationReporting.ts Geolocation reporting
│   │   └── useWorkflows.ts          Workflow/CRON management
│   ├── plugins/
│   │   └── auth.client.ts           Supabase auth → settings sync
│   ├── assets/css/
│   │   └── main.css                 Tailwind + custom styles
│   ├── types/
│   │   └── database.types.ts        Supabase type stubs
│   ├── app.vue                      Root component
│   └── app.config.ts                App configuration
├── server/
│   └── api/
│       └── bug-report.post.ts       Bug report endpoint (Resend)
├── supabase/
│   ├── functions/                   Edge function placeholders
│   └── migrations/
│       ├── 20260327_create_user_memory_bucket.sql
│       └── 20260327_vault_rpc.sql
├── docs/
│   └── supabase-authentications.md  Credentials schema docs
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── nuxt.config.ts
├── package.json
├── tsconfig.json
└── AGENTS.md                        Agent coding rules
```

## Tech stack

- **Nuxt 4** + **Vue 3** + **Nuxt UI v4** — frontend framework and components
- **Bun** — JavaScript runtime and package manager
- **Supabase** — authentication (Google OAuth, email/password)
- **Tailwind CSS v4** — styling
- **liquid-glass-vue** — glass morphism effects
- **marked** — markdown parsing

## API Endpoints

### POST `/api/bug-report`

Submit a bug report via email (requires Resend API configuration).

**Request body:**
```json
{
  "email": "user@example.com",
  "title": "Bug title (max 200 chars)",
  "description": "Detailed description (max 8000 chars)"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Error codes:**
- `400` - Invalid email, title, or description
- `503` - Bug report email not configured (missing `NUXT_RESEND_API_KEY`)
- `502` - Failed to send email
