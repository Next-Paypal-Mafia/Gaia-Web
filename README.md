# Jellybyte Web

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
4. (Optional) Set up credential vault using `docs/vault-rpc.sql` for secure password storage

## Development

```bash
bun run dev
```

Opens [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  pages/index.vue              Main layout: chat + browser viewport
  components/
    BrowserViewport.vue        Live screencast display
    BrowserControls.vue        Address bar and nav buttons
    ChatPanel.vue              AI chat thread and input
    SidePanel.vue              Chat history sidebar
    SettingsModal.vue          Profile and auth settings
    SearchModal.vue            Fuzzy search over chat history
    VaultPanel.vue             File manager panel
    VaultModal.vue             Vault in a modal
  composables/
    useScreencast.ts           Screencast frame state (connect remote WS here)
    useOpenCodeAgent.ts        Chat message state (connect remote API here)
    useSettings.ts             User profile and preferences (localStorage)
  plugins/
    auth.client.ts             Supabase auth → settings sync
```

## Tech stack

- **Nuxt 4** + **Vue 3** + **Nuxt UI v4** — frontend framework and components
- **Bun** — JavaScript runtime
- **Supabase** — authentication (Google OAuth)
- **Tailwind CSS v4** — styling

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
