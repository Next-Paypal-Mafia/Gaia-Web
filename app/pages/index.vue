<script setup lang="ts">
import type { UIMessage } from '~/composables/useOpenCodeAgent'

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const screencast = useScreencast()
const agent = useOpenCodeAgent()

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
  screencast.stop()
  await agent.disconnect()
})

const sidebarOpen = ref(true)
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
  if (isViewingStreamingChat.value) return [...agent.messages.value]
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

// Persist agent stream into the chat that owns it.
watch(
  () => agent.messages.value,
  (messages) => {
    chatSessions.value[streamingChatId.value] = [...messages]
    const firstUser = messages.find(m => m.role === 'user')
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
  <div class="h-screen flex bg-default overflow-hidden">
    <!-- Left side panel -->
    <SidePanel
      :open="sidebarOpen"
      :chat-history="chatsWithMessages"
      :active-chat-id="activeChatId"
      :active-view="activeView"
      :active-workflow-id="activeWorkflowId"
      :pinned-workflows="wf.pinnedWorkflows.value"
      @toggle="sidebarOpen = false"
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
      <!-- Compact header when sidebar is collapsed: toggle + logo on one line -->
      <div v-if="!sidebarOpen" class="flex items-center gap-2 px-2 shrink-0">
        <button
          class="inline-flex items-center justify-center p-2 rounded-xl bg-elevated/90 hover:bg-elevated text-default shadow-sm transition-colors cursor-pointer"
          @click="sidebarOpen = true"
        >
          <UIcon name="i-lucide-panel-left-open" class="size-4 text-primary" />
        </button>
        <div class="flex items-center gap-1.5">
          <UIcon name="i-lucide-earth" class="size-5 text-primary" />
          <span class="font-bold text-sm tracking-tight">Gaia</span>
        </div>
      </div>
      <!-- ═══ Landing / Welcome page ═══ -->
      <Transition name="landing-leave">
        <div v-if="showLanding" class="flex-1 flex flex-col items-center justify-center px-6 relative">
          <div class="flex flex-col items-center max-w-2xl w-full">
            <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <UIcon name="i-lucide-earth" class="size-8 text-primary" />
            </div>
            <h1 class="text-2xl font-semibold text-default mb-1.5 tracking-tight">Welcome to Gaia</h1>
            <p class="text-sm text-muted mb-8">Describe a task and I'll browse the web for you.</p>

            <form class="w-full max-w-lg" @submit.prevent="onLandingSend()">
              <div class="relative group">
                <UTextarea
                  v-model="landingInput"
                  :placeholder="agent.isAgentRunning.value && !isViewingStreamingChat ? 'Agent is busy in another chat...' : 'Ask Gaia to do something...'"
                  :disabled="agent.isAgentRunning.value && !isViewingStreamingChat"
                  autoresize
                  :rows="2"
                  :maxrows="5"
                  size="lg"
                  class="w-full landing-input"
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
                class="px-4 py-2 rounded-full text-xs font-medium text-muted bg-elevated hover:bg-default/80 hover:text-default transition-all border border-transparent hover:border-muted active:scale-[0.97]"
                :class="{ 'pointer-events-none opacity-50': agent.isAgentRunning.value && !isViewingStreamingChat }"
                @click="onLandingSend(s)"
              >
                {{ s }}
              </button>
            </div>

            <p class="text-[11px] text-dimmed mt-8">
              Gaia can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </Transition>

      <!-- ═══ Browser + Chat / Other panels ═══ -->
      <template v-if="!showLanding">
        <!-- Main content area -->
        <div class="flex-1 min-h-0 mx-2 relative overflow-hidden">
          <!-- Browser view: CSS Grid layout that animates between sidebar open/collapsed -->
          <Transition name="browser-reveal">
            <div
              v-show="isBrowserView"
              class="absolute inset-0 browser-grid"
              :class="sidebarOpen ? 'browser-grid--open' : 'browser-grid--collapsed'"
            >
              <!-- Viewport tile -->
              <div class="browser-grid__viewport">
                <div class="w-full aspect-video rounded-2xl overflow-hidden relative">
                  <BrowserViewport
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

              <!-- Agent activity panel -->
              <div class="browser-grid__activity min-h-0 overflow-hidden">
                <AgentActivity
                  :messages="currentMessages"
                  :status="currentStatus"
                  :is-agent-running="currentIsRunning"
                />
              </div>

              <!-- Chat + input -->
              <div class="browser-grid__chat flex flex-col min-h-0">
                <div class="flex-1 min-h-0">
                  <ChatPanel
                    :messages="currentMessages"
                    :status="currentStatus"
                    :is-agent-running="currentIsRunning"
                    :is-connected="!!agent.sessionId.value"
                  />
                </div>
                <div class="shrink-0 flex justify-center py-2" :class="sidebarOpen ? 'px-4' : 'px-2'">
                  <div class="w-full" :class="sidebarOpen ? 'max-w-2xl' : ''">
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
                :sidebar-open="sidebarOpen"
                class="h-full rounded-2xl"
                @show-sidebar="sidebarOpen = true"
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
/* ── Shared GPU hint ──────────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active,
.panel-carousel-enter-active,
.panel-carousel-leave-active,
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

/* ── Vertical carousel ────────────────────────────────────────────────── */
.panel-carousel-enter-active { transition: transform 0.25s ease-in; }
.panel-carousel-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.6, 1); }
.panel-carousel-enter-from { transform: translate3d(0, 100%, 0); }
.panel-carousel-leave-to { transform: translate3d(0, -100%, 0); }

/* ── Landing exit ─────────────────────────────────────────────────────── */
.landing-leave-leave-active {
  transition: opacity 0.25s ease-in, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.landing-leave-leave-to { opacity: 0; transform: translateY(-200px); }

/* ── Browser reveal (Hyprland pop) ────────────────────────────────────── */
.browser-reveal-enter-active {
  transition: opacity 0.4s cubic-bezier(0.05, 0.9, 0.1, 1.05),
              transform 0.5s cubic-bezier(0.05, 0.9, 0.1, 1.1);
}
.browser-reveal-enter-from { opacity: 0; transform: translateY(40px); }
.browser-reveal-leave-active {
  transition: opacity 0.2s ease-in, transform 0.25s cubic-bezier(0.4, 0, 1, 1);
}
.browser-reveal-leave-to { opacity: 0; transform: translateY(200px); }

/* ═══ Browser Grid — animated tiling layout ═══════════════════════════
   Sidebar open:  viewport + activity side-by-side on top, chat below
   Sidebar closed: viewport + activity stacked on left, chat fills right
   Uses CSS grid-template transitions for Hyprland-style smooth retiling */

.browser-grid {
  display: grid;
  gap: 0.5rem;
  transition: grid-template-columns 0.5s cubic-bezier(0.05, 0.9, 0.1, 1.05),
              grid-template-rows 0.5s cubic-bezier(0.05, 0.9, 0.1, 1.05);
}

.browser-grid__viewport,
.browser-grid__activity,
.browser-grid__chat {
  transition: transform 0.5s cubic-bezier(0.05, 0.9, 0.1, 1.05),
              opacity 0.35s ease;
  will-change: transform, opacity;
}

/* Sidebar OPEN: 2-column top row (viewport | activity), chat spans bottom */
.browser-grid--open {
  grid-template-columns: 55% 1fr;
  grid-template-rows: auto 1fr;
}
.browser-grid--open .browser-grid__viewport  { grid-row: 1; grid-column: 1; }
.browser-grid--open .browser-grid__activity  { grid-row: 1; grid-column: 2; }
.browser-grid--open .browser-grid__chat      { grid-row: 2; grid-column: 1 / -1; }

/* Sidebar COLLAPSED: left stack (viewport over activity), chat fills right */
.browser-grid--collapsed {
  grid-template-columns: 42% 1fr;
  grid-template-rows: auto 1fr;
}
.browser-grid--collapsed .browser-grid__viewport  { grid-row: 1; grid-column: 1; }
.browser-grid--collapsed .browser-grid__activity  { grid-row: 2; grid-column: 1; }
.browser-grid--collapsed .browser-grid__chat      { grid-row: 1 / -1; grid-column: 2; }
</style>
