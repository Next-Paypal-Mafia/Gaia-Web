<script setup lang="ts">
import type { UIMessage } from '~/composables/useOpenCodeAgent'

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const screencast = useScreencast()
const agent = useOpenCodeAgent()

let tilingAnimTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  const apiUrl = config.public.agentApiUrl
  if (!apiUrl) {
    console.warn('[Gaia] NUXT_PUBLIC_AGENT_API_URL is not set — skipping session creation')
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  await agent.connect(apiUrl, token)

  if (agent.sessionId.value) {
    screencast.start(apiUrl, agent.sessionId.value, token)
  }
})

onUnmounted(async () => {
  if (tilingAnimTimer) clearTimeout(tilingAnimTimer)
  screencast.stop()
  await agent.disconnect()
})

/** Full sidebar vs icon rail (default: rail for wider browser viewport) */
const sidebarExpanded = ref(false)

/** Brief pulse so tile children replay Hyprland-style settle animations on layout retile */
const tilingAnimActive = ref(false)
watch(sidebarExpanded, () => {
  tilingAnimActive.value = true
  if (tilingAnimTimer) clearTimeout(tilingAnimTimer)
  tilingAnimTimer = setTimeout(() => {
    tilingAnimActive.value = false
    tilingAnimTimer = null
  }, 560)
})
const activeView = ref<'dashboard' | 'vault' | 'authentications' | 'profile' | null>(null)
const activeWorkflowId = ref<string | null>(null)
const activeWorkflowTitle = ref<string>('')
const activeChatId = ref('chat-1')
// Tracks which chat currently owns `agent.messages` / the SSE stream.
// Stays pinned to the originating chat even when the user browses elsewhere.
const streamingChatId = ref(activeChatId.value)
const chatHistory = ref([
  { id: 'chat-1', title: 'New chat' },
])
const chatSessions = ref<Record<string, UIMessage[]>>({ 'chat-1': [] })

// Workflows + pins (max 3)
const wf = useWorkflows()

const isBrowserView = computed(() => activeView.value === null && activeWorkflowId.value === null)

// ── Derived state for the currently viewed chat ──────────────────────────────
const isViewingStreamingChat = computed(() => activeChatId.value === streamingChatId.value)

const currentMessages = computed<UIMessage[]>(() => {
  if (isViewingStreamingChat.value) return [...agent.messages.value] as UIMessage[]
  return chatSessions.value[activeChatId.value] ?? []
})

const currentStatus = computed(() =>
  isViewingStreamingChat.value ? agent.status.value : 'ready',
)

const currentIsRunning = computed(() =>
  isViewingStreamingChat.value && agent.isAgentRunning.value,
)

// ── Landing / browser-reveal animation ───────────────────────────────────────
const browserRevealed = ref(false)
const showLanding = computed(() =>
  isBrowserView.value && currentMessages.value.length === 0 && !browserRevealed.value,
)

const landingInput = ref('')
const suggestions = [
  'Search for the latest AI news',
  'Find the best-rated restaurants nearby',
  'Compare prices for a laptop',
  'Look up flights from NYC to London',
]

function setActiveChatTitleFromText(text: string) {
  const title = text.trim().slice(0, 40) || 'New chat'
  const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
  const item = chatHistory.value[idx]
  if (idx !== -1 && item) item.title = title
}

function onLandingSend(text?: string) {
  const msg = (text ?? landingInput.value).trim()
  if (!msg) return
  landingInput.value = ''
  browserRevealed.value = true
  setActiveChatTitleFromText(msg)
  bindAgentToActiveChat()
  nextTick(() => {
    agent.sendInstruction(msg)
  })
}

watch(() => agent.messages.value.length, (len) => {
  if (len === 0 && isViewingStreamingChat.value) browserRevealed.value = false
})

// Auto-collapse sidebar when entering browser view
const hoverSidebarActive = computed(() => isBrowserView.value && !showLanding.value)

watch(hoverSidebarActive, (newVal) => {
  if (newVal) {
    sidebarExpanded.value = false
  }
})

// Persist agent stream into the chat that owns it.
watch(
  () => agent.messages.value,
  (messages) => {
    chatSessions.value[streamingChatId.value] = [...messages] as UIMessage[]
    const firstUser = messages.find((m: any) => m.role === 'user')
    const firstText = firstUser?.parts?.find((p: any) => p.type === 'text')?.text as string | undefined
    const idx = chatHistory.value.findIndex(c => c.id === streamingChatId.value)
    const item = chatHistory.value[idx]
    if (firstText && idx !== -1 && item && (item.title === 'New chat' || !item.title.trim())) {
      item.title = firstText.trim().slice(0, 40) || 'New chat'
    }
  },
  { deep: true },
)

// ── Chat history helpers ─────────────────────────────────────────────────────
const chatsWithMessages = computed(() =>
  chatHistory.value.filter(c =>
    (chatSessions.value[c.id]?.length ?? 0) > 0
    || c.id === activeChatId.value
    || (c.id === streamingChatId.value && agent.messages.value.length > 0),
  ),
)

const vaultOpenProxy = computed({
  get: () => activeView.value === 'vault',
  set: (val: boolean) => {
    if (!val) activeView.value = null
  },
})

function getChatTitle(messages: UIMessage[]): string {
  const first = messages.find(m => m.role === 'user')
  if (!first) return 'New chat'
  const text = first.parts?.find(p => p.type === 'text')?.text || ''
  return text.trim().slice(0, 40) || 'New chat'
}

function getMessageCount(chatId: string): number {
  if (chatId === streamingChatId.value) return agent.messages.value.length
  return chatSessions.value[chatId]?.length ?? 0
}

/**
 * If the active chat isn't the one the agent is streaming to,
 * snapshot the old stream and rebind the agent to the active chat.
 */
function bindAgentToActiveChat() {
  if (activeChatId.value === streamingChatId.value) return
  chatSessions.value[streamingChatId.value] = agent.getMessages()
  const stored = chatSessions.value[activeChatId.value] ?? []
  streamingChatId.value = activeChatId.value
  agent.resetChat([...stored])
}

function onNewChat() {
  // Snapshot the current agent into its owning chat (only if idle)
  if (!agent.isAgentRunning.value) {
    chatSessions.value[streamingChatId.value] = agent.getMessages()
    const idx = chatHistory.value.findIndex(c => c.id === streamingChatId.value)
    const item = chatHistory.value[idx]
    if (idx !== -1 && item && agent.getMessages().length > 0) {
      item.title = getChatTitle(agent.getMessages())
    }
  }

  const unusedChat = chatHistory.value.find(c =>
    getMessageCount(c.id) === 0 && c.id !== streamingChatId.value,
  )
  if (unusedChat) {
    activeChatId.value = unusedChat.id
    activeView.value = null
    activeWorkflowId.value = null
    browserRevealed.value = false
    if (!agent.isAgentRunning.value) {
      streamingChatId.value = unusedChat.id
      agent.resetChat()
    }
    return
  }

  const newId = `chat-${Date.now()}`
  chatHistory.value.unshift({ id: newId, title: 'New chat' })
  chatSessions.value[newId] = []
  activeChatId.value = newId
  activeView.value = null
  activeWorkflowId.value = null
  browserRevealed.value = false
  if (!agent.isAgentRunning.value) {
    streamingChatId.value = newId
    agent.resetChat()
  }
}

function onSelectChat(id: string) {
  if (id === activeChatId.value && isBrowserView.value) return

  // If agent is idle, persist its state before switching
  if (!agent.isAgentRunning.value) {
    chatSessions.value[streamingChatId.value] = agent.getMessages()
    const idx = chatHistory.value.findIndex(c => c.id === streamingChatId.value)
    const item = chatHistory.value[idx]
    if (idx !== -1 && item && agent.getMessages().length > 0) {
      item.title = getChatTitle(agent.getMessages())
    }
  }

  activeChatId.value = id
  activeView.value = null
  activeWorkflowId.value = null

  const stored = chatSessions.value[id] ?? []
  browserRevealed.value = stored.length > 0

  // Rebind the agent only when idle
  if (!agent.isAgentRunning.value) {
    streamingChatId.value = id
    agent.resetChat([...stored])
  }
}

function onSelectWorkflow(id: string, title: string) {
  activeWorkflowId.value = id
  activeWorkflowTitle.value = title
  activeView.value = null
}

function onSelectView(view: 'dashboard' | 'newchat' | 'vault' | 'authentications' | 'profile') {
  if (view === 'newchat') {
    onNewChat()
    return
  }
  activeView.value = view as 'dashboard' | 'vault' | 'authentications' | 'profile'
  activeWorkflowId.value = null
}

function onOpenWorkflowFromDashboard(id: string, title: string) {
  onSelectWorkflow(id, title)
}

function onCreateWorkflowFromDashboard(type: 'workflow' | 'cron') {
  const id = wf.createWorkflow(type)
  const created = wf.workflows.value.find(w => w.id === id)
  if (created) onSelectWorkflow(created.id, created.title)
}

function onTogglePinWorkflow(id: string) {
  const res = wf.togglePin(id)
  if (!res.ok && res.reason === 'limit') {
    const toast = useToast()
    toast.add({
      title: 'Pin limit reached',
      description: 'You can pin up to 3 workflows in the sidebar.',
      icon: 'i-lucide-pin',
      color: 'warning',
    })
  }
}

function onRenameWorkflow(id: string, title: string) {
  wf.renameWorkflow(id, title)
  if (activeWorkflowId.value === id) {
    activeWorkflowTitle.value = title
  }
}

function onDeleteWorkflow(id: string) {
  wf.deleteWorkflow(id)
  if (activeWorkflowId.value === id) {
    activeWorkflowId.value = null
    activeView.value = 'dashboard'
  }
}

function onRenameChat(id: string, title: string) {
  const idx = chatHistory.value.findIndex(c => c.id === id)
  const item = chatHistory.value[idx]
  if (idx !== -1 && item) {
    item.title = title
  }
}

function onDeleteChat(id: string) {
  const idx = chatHistory.value.findIndex(c => c.id === id)
  if (idx === -1) return

  // If deleting the chat that owns the active stream, stop it
  if (id === streamingChatId.value) {
    agent.stop()
    agent.resetChat()
  }

  chatHistory.value.splice(idx, 1)
  delete chatSessions.value[id]

  if (id === activeChatId.value) {
    const first = chatHistory.value[0]
    if (first) {
      activeChatId.value = first.id
      streamingChatId.value = first.id
      const restored = chatSessions.value[first.id] ?? []
      browserRevealed.value = restored.length > 0
      agent.resetChat([...restored])
    }
    else {
      onNewChat()
    }
  }
}

function onSendInstruction(text: string) {
  // If sending from a chat that isn't the streaming one, rebind first
  bindAgentToActiveChat()

  if (agent.messages.value.length === 0) {
    setActiveChatTitleFromText(text)
  }
  agent.sendInstruction(text)
}
</script>

<template>
  <div class="h-screen flex bg-default overflow-hidden relative">
    <!-- Jellyfish ambient glow orbs -->
    <div class="jelly-orbs">
      <div class="jelly-orb jelly-orb--1" />
      <div class="jelly-orb jelly-orb--2" />
      <div class="jelly-orb jelly-orb--3" />
    </div>
    <!-- Left side panel -->
    <SidePanel
      :expanded="sidebarExpanded"
      :is-browser-view="hoverSidebarActive"
      :chat-history="chatsWithMessages"
      :active-chat-id="activeChatId"
      :active-view="activeView"
      :active-workflow-id="activeWorkflowId"
      :pinned-workflows="wf.pinnedWorkflows.value"
      @toggle="sidebarExpanded = false"
      @expand="sidebarExpanded = true"
      @new-chat="onNewChat"
      @select-chat="onSelectChat"
      @select-workflow="onSelectWorkflow"
      @select-view="onSelectView"
      @rename-chat="onRenameChat"
      @delete-chat="onDeleteChat"
      @toggle-pin-workflow="onTogglePinWorkflow"
      @rename-workflow="onRenameWorkflow"
      @delete-workflow="onDeleteWorkflow"
    />

    <!-- Right side -->
    <div class="flex-1 flex flex-col min-w-0 gap-2 py-2 overflow-hidden">
      <!-- ═══ Landing / Welcome page ═══ -->
      <Transition name="landing-leave">
        <div v-if="showLanding" class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
          <div class="flex flex-col items-center max-w-2xl w-full glass rounded-3xl px-8 py-10">
            <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <UIcon name="i-lucide-earth" class="size-8 text-primary" />
            </div>
            <h1 class="text-2xl font-semibold text-default mb-1.5 tracking-tight">Welcome to jellybyte</h1>
            <p class="text-sm text-muted mb-8">Describe a task and I'll browse the web for you.</p>

            <form class="w-full max-w-lg" @submit.prevent="onLandingSend()">
              <div class="relative group">
                <UTextarea
                  v-model="landingInput"
                  :placeholder="agent.isAgentRunning.value && !isViewingStreamingChat ? 'Agent is busy in another chat...' : 'Ask jellybyte to do something...'"
                  :disabled="agent.isAgentRunning.value && !isViewingStreamingChat"
                  autoresize
                  :rows="2"
                  :maxrows="5"
                  size="lg"
                  class="w-full landing-input landing-glass-input"
                  @keydown.enter.exact.prevent="onLandingSend()"
                />
                <button
                  type="submit"
                  :disabled="!landingInput.trim() || (agent.isAgentRunning.value && !isViewingStreamingChat)"
                  class="absolute bottom-3 right-3 size-9 rounded-full bg-primary text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95"
                >
                  <UIcon name="i-lucide-arrow-up" class="size-4" />
                </button>
              </div>
            </form>

            <div class="flex flex-wrap justify-center gap-2 mt-6">
              <button
                v-for="s in suggestions"
                :key="s"
                class="px-4 py-2 rounded-full text-xs font-medium text-muted hover:text-default bg-default/60 dark:bg-white/[0.04] hover:bg-default/80 dark:hover:bg-white/[0.08] transition-all border border-default/40 dark:border-white/[0.08] hover:border-primary/30 active:scale-[0.97]"
                :class="{ 'pointer-events-none opacity-50': agent.isAgentRunning.value && !isViewingStreamingChat }"
                @click="onLandingSend(s)"
              >
                {{ s }}
              </button>
            </div>

            <p class="text-[11px] text-dimmed mt-8">
              jellybyte can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </Transition>

      <!-- ═══ Browser + Chat / Other panels ═══ -->
      <template v-if="!showLanding">
        <!-- Main content area -->
        <div class="flex-1 min-h-0 mx-2 relative overflow-hidden flex flex-col">
          <!-- Browser view: viewport + agent (chat lives in agent panel as glass carousel); input fixed below -->
          <Transition name="browser-reveal">
            <div
              v-show="isBrowserView"
              class="absolute inset-0 flex flex-col gap-2 min-h-0 z-10"
            >
              <div class="flex-1 min-h-0 relative overflow-hidden">
                <div
                  class="absolute inset-0 browser-grid"
                  :class="[
                    sidebarExpanded ? 'browser-grid--expanded' : 'browser-grid--rail',
                    tilingAnimActive ? 'browser-grid--tiling' : '',
                  ]"
                >
                  <!-- Viewport tile -->
                  <div class="browser-grid__viewport min-h-0">
                    <div class="w-full h-full min-h-0 rounded-2xl overflow-hidden relative flex flex-col">
                      <BrowserViewport
                        class="flex-1 min-h-0"
                        :frame="screencast.currentFrame.value"
                        :is-connected="screencast.isStreaming.value"
                        :is-loading="false"
                        :page-background-color="screencast.pageBackgroundColor.value"
                      />
                      <div class="absolute bottom-2.5 left-2.5">
                        <span
                          v-if="screencast.isStreaming.value"
                          class="flex items-center gap-1.5 text-[11px] bg-black/60 backdrop-blur-sm text-white/90 px-2.5 py-1 rounded-full"
                        >
                          <span class="size-1.5 rounded-full bg-success animate-pulse" />
                          Live
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Agent: thinking + glass chat carousel -->
                  <div class="browser-grid__activity min-h-0 overflow-hidden">
                    <Transition name="content-fade" mode="out-in">
                      <AgentActivity
                        :key="activeChatId"
                        :messages="currentMessages"
                        :status="currentStatus"
                        :is-agent-running="currentIsRunning"
                        :is-connected="!!agent.sessionId.value"
                      />
                    </Transition>
                  </div>
                </div>
              </div>

              <div class="shrink-0 flex justify-center py-1.5 px-2 sm:px-4">
                <div class="w-full max-w-3xl">
                  <ChatInput
                    :is-agent-running="currentIsRunning"
                    :is-connected="!!agent.sessionId.value"
                    :input-locked="agent.isAgentRunning.value && !isViewingStreamingChat"
                    @send="onSendInstruction"
                    @stop="agent.stop"
                  />
                </div>
              </div>
            </div>
          </Transition>

          <!-- Vertical carousel: one panel at a time, mode="out-in" for sequential slide -->
          <Transition v-if="!isBrowserView" name="panel-carousel" mode="out-in">
            <div
              v-if="activeView === 'vault'"
              key="vault"
              class="absolute inset-0 w-full h-full"
            >
              <VaultPanel
                v-model:open="vaultOpenProxy"
                :sidebar-expanded="sidebarExpanded"
                class="h-full rounded-2xl"
                @show-sidebar="sidebarExpanded = true"
              />
            </div>
            <div
              v-else-if="activeView === 'dashboard'"
              key="dashboard"
              class="absolute inset-0 w-full h-full"
            >
              <DashboardPanel
                :workflows="wf.workflows.value"
                :pinned-ids="wf.pinnedIds.value"
                :can-pin-more="wf.canPinMore.value"
                @open-workflow="onOpenWorkflowFromDashboard"
                @create-workflow="onCreateWorkflowFromDashboard"
                @toggle-pin="onTogglePinWorkflow"
                @rename-workflow="onRenameWorkflow"
                @delete-workflow="onDeleteWorkflow"
              />
            </div>
            <div
              v-else-if="activeView === 'authentications'"
              key="authentications"
              class="absolute inset-0 w-full h-full"
            >
              <AuthenticationsPanel />
            </div>
            <div
              v-else-if="activeView === 'profile'"
              key="profile"
              class="absolute inset-0 w-full h-full overflow-y-auto"
            >
              <ProfilePanel @back="activeView = null" />
            </div>
            <div
              v-else-if="activeWorkflowId !== null"
              :key="`workflow-${activeWorkflowId}`"
              class="absolute inset-0 w-full h-full"
            >
              <WorkflowPanel :workflow-title="activeWorkflowTitle" />
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Landing glass input ──────────────────────────────────────────────── */
.landing-glass-input :deep(textarea) {
  background: rgba(0, 0, 0, 0.02) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 1rem !important;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
:global(.dark) .landing-glass-input :deep(textarea) {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.landing-glass-input :deep(textarea:focus) {
  border-color: var(--ui-color-primary-500) !important;
  box-shadow: 0 0 20px -8px rgba(139, 92, 246, 0.2) !important;
}

/* ── Shared: GPU-friendly, reduce paint ───────────────────────────────── */
.fade-enter-active,
.fade-leave-active,
.panel-carousel-enter-active,
.panel-carousel-leave-active,
.content-fade-enter-active,
.content-fade-leave-active,
.landing-leave-leave-active,
.browser-reveal-enter-active,
.browser-reveal-leave-active {
  will-change: opacity, transform;
  backface-visibility: hidden;
}

/* ── Fade ─────────────────────────────────────────────────────────────── */
.fade-enter-active { transition: opacity 0.35s ease-out; }
.fade-leave-active { transition: opacity 0.2s ease-in; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* ── Content fade (chat switching) — subtle slide + scale like window swap ── */
.content-fade-enter-active {
  transition: opacity 0.32s cubic-bezier(0.18, 1, 0.28, 1),
              transform 0.32s cubic-bezier(0.18, 1, 0.28, 1);
}
.content-fade-leave-active {
  transition: opacity 0.22s cubic-bezier(0.4, 0, 0.65, 1),
              transform 0.22s cubic-bezier(0.4, 0, 0.65, 1);
}
.content-fade-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.988);
}
.content-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.994);
}

/* ── Panel carousel: crossfade (no slide) ───────────────────────────────── */
.panel-carousel-enter-active,
.panel-carousel-leave-active {
  transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.panel-carousel-enter-from,
.panel-carousel-leave-to { opacity: 0; }

/* ── Landing exit ─────────────────────────────────────────────────────── */
.landing-leave-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.landing-leave-leave-to { opacity: 0; }

/* ── Browser reveal: “pop” into tiling workspace (Hyprland-like overshoot) ─ */
.browser-reveal-enter-active {
  transition: opacity 0.38s cubic-bezier(0.18, 1, 0.28, 1),
              transform 0.52s cubic-bezier(0.14, 1.18, 0.26, 1);
}
.browser-reveal-leave-active {
  transition: opacity 0.24s cubic-bezier(0.4, 0, 0.7, 1),
              transform 0.28s cubic-bezier(0.4, 0, 1, 1);
}
.browser-reveal-enter-from {
  opacity: 0;
  transform: translateY(36px) scale(0.92);
}
.browser-reveal-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}

/* ═══ Browser grid — dynamic tiling (inspired by Hyprland window motion)
   https://github.com/hyprwm/Hyprland — smooth decel + slight overshoot on retile */

.browser-grid {
  display: grid;
  gap: 0.5rem;
  /* Grid tracks interpolate smoothly as “containers” reflow */
  transition: grid-template-columns 0.52s cubic-bezier(0.18, 1, 0.28, 1),
              grid-template-rows 0.52s cubic-bezier(0.18, 1, 0.28, 1),
              gap 0.35s cubic-bezier(0.18, 1, 0.28, 1);
}

.browser-grid__viewport,
.browser-grid__activity {
  transform-origin: center center;
  transition: transform 0.52s cubic-bezier(0.18, 1, 0.28, 1),
              opacity 0.38s cubic-bezier(0.18, 1, 0.28, 1),
              filter 0.38s cubic-bezier(0.18, 1, 0.28, 1);
}

.browser-grid--tiling .browser-grid__viewport,
.browser-grid--tiling .browser-grid__activity {
  will-change: transform, filter;
}

/* Staggered “settle” when sidebar toggles — tiles breathe like windows snapping */
.browser-grid--tiling .browser-grid__viewport {
  animation: hypr-tile-settle 0.52s cubic-bezier(0.16, 1.1, 0.28, 1) both;
}
.browser-grid--tiling .browser-grid__activity {
  animation: hypr-tile-settle 0.54s cubic-bezier(0.16, 1.1, 0.28, 1) 0.04s both;
}

@keyframes hypr-tile-settle {
  0% {
    transform: translateZ(0) scale(0.985);
    filter: brightness(0.96);
  }
  58% {
    transform: translateZ(0) scale(1.008);
    filter: brightness(1.03);
  }
  100% {
    transform: translateZ(0) scale(1);
    filter: brightness(1);
  }
}

/* Full sidebar: balanced split */
.browser-grid--expanded {
  grid-template-columns: minmax(0, 1fr) 400px;
  grid-template-rows: 1fr;
}
.browser-grid--expanded .browser-grid__viewport { grid-row: 1; grid-column: 1; }
.browser-grid--expanded .browser-grid__activity { grid-row: 1; grid-column: 2; }

/* Icon rail: favor browser viewport width */
.browser-grid--rail {
  grid-template-columns: minmax(0, 1fr) 400px;
  grid-template-rows: 1fr;
}
.browser-grid--rail .browser-grid__viewport { grid-row: 1; grid-column: 1; }
.browser-grid--rail .browser-grid__activity { grid-row: 1; grid-column: 2; }

@media (prefers-reduced-motion: reduce) {
  .browser-grid,
  .browser-grid__viewport,
  .browser-grid__activity {
    transition-duration: 0.01ms !important;
  }
  .browser-grid--tiling .browser-grid__viewport,
  .browser-grid--tiling .browser-grid__activity {
    animation: none !important;
  }
  .content-fade-enter-active,
  .content-fade-leave-active,
  .browser-reveal-enter-active,
  .browser-reveal-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>
