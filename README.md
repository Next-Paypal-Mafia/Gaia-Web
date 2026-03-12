# Gaia — Browser Agent

Control a real browser through an AI agent, right from your browser. Gaia connects directly to Chrome via the DevTools Protocol (CDP) and uses an LLM to translate your natural language instructions into browser actions — navigate, click, type, scroll, and more.

## How it works

```
You (chat) → Gaia (Vercel AI SDK) → Chrome DevTools Protocol → Headless Chrome
                                                                      ↓
                                                  Live screencast → Your browser viewport
```

- **Client-side CDP**: The browser viewport connects directly to Chrome's CDP WebSocket from your browser tab — no Playwright needed
- **Server-side agent**: Vercel AI SDK runs the agent loop with tool calling, executing browser actions through a separate CDP connection
- **Live screencast**: Chrome streams JPEG frames via `Page.startScreencast`, rendered in real-time

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [Google Chrome](https://www.google.com/chrome/) or Chromium
- A [Google Gemini API key](https://aistudio.google.com/apikey)

## Setup

```bash
# Install dependencies
bun install

# Copy env file and add your API key
cp .env.example .env
# Edit .env and set GOOGLE_GENERATIVE_AI_API_KEY
```

## Usage

**Option A: Two terminals**

```bash
# Terminal 1 — start Chrome with debugging
bun run dev:chrome

# Terminal 2 — start the app
bun run dev
```

**Option B: Single command**

```bash
bun run dev:all
```

Then open [http://localhost:3000](http://localhost:3000) and click **Connect** to link to the headless Chrome instance.

## Project structure

```
app/
  pages/index.vue              Main layout: chat + browser viewport
  components/
    ChatPanel.vue              Chat interface with agent messages
    BrowserViewport.vue        Live screencast renderer
    BrowserControls.vue        URL bar, navigation buttons
  composables/
    useCDP.ts                  Client-side CDP WebSocket client
    useScreencast.ts           Chrome screencast frame streaming
    useBrowserActions.ts       Navigate, click, type, scroll via CDP
    useAgent.ts                AI agent state management
server/
  api/
    cdp.get.ts                 CDP WebSocket endpoint discovery
    agent.post.ts              Vercel AI SDK agent with browser tools
  utils/
    cdp-server.ts              Server-side CDP client
    browser-tools.ts           AI tool definitions for browser actions
scripts/
  start-chrome.sh              Chrome launcher with debug port
```

## Tech stack

- **Nuxt 4** + **Vue 3** + **Nuxt UI v4** — frontend framework and components
- **Bun** — JavaScript runtime
- **Vercel AI SDK** — agent loop with tool calling and streaming
- **Chrome DevTools Protocol** — direct browser control via WebSocket
- **Google Gemini** — LLM provider (swappable)
