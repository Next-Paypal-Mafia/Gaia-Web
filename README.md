# Jellybyte Web

AI-powered browser agent interface. Chat with an AI agent that controls a remote browser, with a live screencast streamed back to your viewport.

## Setup

```bash
# Install dependencies
bun install

# Copy env file and fill in your Supabase credentials
cp .env.example .env
```

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
