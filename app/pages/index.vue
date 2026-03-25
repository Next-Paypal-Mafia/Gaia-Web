<script setup lang="ts">
import type { UIMessage } from '~/composables/useOpenCodeAgent'
import {
  buildPersistedPayload,
  cloneUIMessages,
  persistChatState,
  readChatBootstrap,
} from '~/composables/useChatLocalPersistence'
import { useApiVersion } from '~/composables/useApiVersion'

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const toast = useToast()

const boot = readChatBootstrap()
const activeChatId = ref(boot.activeChatId)
const streamingChatId = ref(boot.streamingChatId)
const chatHistory = ref(boot.chatHistory)
const chatSessions = ref<Record<string, UIMessage[]>>(boot.chatSessions)
const browserRevealed = ref(boot.browserRevealed)
const dismissedTaskFeedbackAssistantIds = ref(new Set(boot.dismissedFeedbackIds))

const screencast = useScreencast()
const agent = useOpenCodeAgent()
const apiVersion = useApiVersion()
/** Hydrate agent memory from the restored tab so Activity matches chatSessions (fixes empty panel on reload). */
agent.resetChat(cloneUIMessages(chatSessions.value[streamingChatId.value] ?? []))

let tilingAnimTimer: ReturnType<typeof setTimeout> | null = null

let persistTimer: ReturnType<typeof setTimeout> | null = null
function flushPersistChatsSync() {
  if (!import.meta.client) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persistChatState(
    buildPersistedPayload(
      chatHistory.value,
      chatSessions.value,
      activeChatId.value,
      streamingChatId.value,
      browserRevealed.value,
      Array.from(dismissedTaskFeedbackAssistantIds.value),
    ),
  )
}
function schedulePersistChats() {
  if (!import.meta.client) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    flushPersistChatsSync()
  }, 900)
}

watch(
  () => chatHistory.value,
  () => schedulePersistChats(),
  { deep: true },
)
watch([activeChatId, streamingChatId, browserRevealed], () => schedulePersistChats())
watch(
  () => [...dismissedTaskFeedbackAssistantIds.value].sort().join('\0'),
  () => schedulePersistChats(),
)

const wf = useWorkflows()

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
const activeView = ref<"dashboard" | "vault" | "authentications" | "profile" | null>(null)
const activeWorkflowId = ref<string | null>(null)
const activeWorkflowTitle = ref<string>('')

const isBrowserView = computed(() => activeView.value === null && activeWorkflowId.value === null)

// ── Derived state for the currently viewed chat ──────────────────────────────
const isViewingStreamingChat = computed(() => activeChatId.value === streamingChatId.value)

const currentMessages = computed<UIMessage[]>(() => {
  if (isViewingStreamingChat.value) return agent.messages.value as unknown as UIMessage[]
  return chatSessions.value[activeChatId.value] ?? []
})

const currentStatus = computed(() =>
  isViewingStreamingChat.value ? agent.status.value : 'ready',
)

const currentIsRunning = computed(() =>
  isViewingStreamingChat.value && agent.isAgentRunning.value,
)

/** One agent session + one screencast — viewport follows the “live” chat, not necessarily the selected row */
const liveBrowserMismatch = computed(
  () =>
    !isViewingStreamingChat.value
    && (agent.isAgentRunning.value || screencast.isStreaming.value),
)

const streamingChatTitle = computed(() => {
  const id = streamingChatId.value
  const item = chatHistory.value.find(c => c.id === id)
  const t = item?.title?.trim()
  return t && t.length > 0 ? t : 'another chat'
})

function openLiveBrowserChat() {
  onSelectChat(streamingChatId.value)
}

const showLanding = computed(() =>
  isBrowserView.value && currentMessages.value.length === 0 && !browserRevealed.value,
)

/** Beta task-completion feedback: short delay after agent finishes */
const taskFeedbackOpen = ref(false)
/** True after the survey card has entered (avoid locking input before it is visible) */
const taskFeedbackBannerEntered = ref(false)
watch(taskFeedbackOpen, (open) => {
  if (!open)
    taskFeedbackBannerEntered.value = false
})
const surveyLocksChat = computed(() => taskFeedbackOpen.value && taskFeedbackBannerEntered.value)
let taskFeedbackTimer: ReturnType<typeof setTimeout> | null = null
const taskFeedbackAssistantId = ref<string | null>(null)
function dismissTaskFeedbackForAssistant(id: string) {
  const next = new Set(dismissedTaskFeedbackAssistantIds.value)
  next.add(id)
  dismissedTaskFeedbackAssistantIds.value = next
  schedulePersistChats()
}

function clearTaskFeedbackTimer() {
  if (taskFeedbackTimer) {
    clearTimeout(taskFeedbackTimer)
    taskFeedbackTimer = null
  }
}

function lastAssistantMessageId(msgs: UIMessage[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role === "assistant") return m.id
  }
  return null
}

watch(
  currentIsRunning,
  (running, wasRunning) => {
    if (running) {
      clearTaskFeedbackTimer()
      taskFeedbackOpen.value = false
      return
    }
    if (wasRunning !== true) return
    if (!isBrowserView.value || showLanding.value || !isViewingStreamingChat.value) return
    if (currentStatus.value !== 'ready') return
    const msgs = currentMessages.value
    if (msgs.length === 0) return
    const aid = lastAssistantMessageId(msgs)
    if (!aid || dismissedTaskFeedbackAssistantIds.value.has(aid)) return

    clearTaskFeedbackTimer()
    taskFeedbackTimer = setTimeout(() => {
      taskFeedbackTimer = null
      if (currentIsRunning.value) return
      if (!isBrowserView.value || showLanding.value || !isViewingStreamingChat.value) return
      if (currentStatus.value !== 'ready') return
      const m = currentMessages.value
      const still = lastAssistantMessageId(m)
      if (still !== aid) return
      if (dismissedTaskFeedbackAssistantIds.value.has(aid)) return
      taskFeedbackAssistantId.value = aid
      taskFeedbackOpen.value = true
    }, 2_500)
  },
  { flush: 'post' },
)

watch([activeChatId, isViewingStreamingChat, isBrowserView, showLanding], () => {
  clearTaskFeedbackTimer()
  taskFeedbackOpen.value = false
  taskFeedbackAssistantId.value = null
})

function onTaskFeedbackVote(sentiment: 'positive' | 'negative') {
  const id = taskFeedbackAssistantId.value
  if (id) dismissTaskFeedbackForAssistant(id)
  agent.appendBetaFeedback(sentiment)
  taskFeedbackOpen.value = false
  taskFeedbackAssistantId.value = null
  schedulePersistChats()
}

onMounted(async () => {
  const apiUrl = config.public.serverUrl
  if (!apiUrl) {
    console.warn('[jellybyte] SERVER_URL is not set — skipping session creation')
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const { compatible, serverVersion, error } = await apiVersion.checkVersion(apiUrl)
  if (!compatible) {
    console.warn(`[jellybyte] API Version Mismatch: expected ${apiVersion.EXPECTED_API_VERSION}, got ${serverVersion}. Error: ${error}`)
    toast.add({
      title: 'Backend API Version Mismatch',
      description: `The server (${serverVersion || 'unknown'}) is incompatible with this client (${apiVersion.EXPECTED_API_VERSION}). Some features may not work.`,
      icon: 'i-lucide-alert-triangle',
      color: 'warning',
      duration: 10000,
    })
  }

  await agent.connect(apiUrl, token)

  if (agent.sessionId.value) {
    screencast.start(apiUrl, agent.sessionId.value, token)
  }
})

onUnmounted(async () => {
  if (tilingAnimTimer) clearTimeout(tilingAnimTimer)
  clearTaskFeedbackTimer()
  flushPersistChatsSync()
  screencast.stop()
  await agent.disconnect()
})

// ── Landing / browser-reveal animation ───────────────────────────────────────
const landingInput = ref('')
const suggestions = [
  "Search for the latest AI news",
  "Find the best-rated restaurants nearby",
  "Compare prices for a laptop",
  "Look up flights from NYC to London",
]

function setActiveChatTitleFromText(text: string) {
  const title = text.trim().slice(0, 40) || "New chat"
  const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
  const item = chatHistory.value[idx]
  if (idx !== -1 && item) item.title = title
}

function onLandingSend(text?: string) {
  if (agent.isAgentRunning.value || surveyLocksChat.value) return
  const msg = (text ?? landingInput.value).trim()
  if (!msg) return
  clearTaskFeedbackTimer()
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
    const firstUser = messages.find((m: any) => m.role === "user")
    const firstText = firstUser?.parts?.find((p: any) => p.type === "text")?.text as string | undefined
    const idx = chatHistory.value.findIndex(c => c.id === streamingChatId.value)
    const item = chatHistory.value[idx]
    if (firstText && idx !== -1 && item && (item.title === "New chat" || !item.title.trim())) {
      item.title = firstText.trim().slice(0, 40) || "New chat"
    }
    schedulePersistChats()
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
  get: () => activeView.value === "vault",
  set: (val: boolean) => {
    if (!val) activeView.value = null
  },
})

function getChatTitle(messages: UIMessage[]): string {
  const first = messages.find(m => m.role === "user")
  if (!first) return "New chat"
  const text = first.parts?.find(p => p.type === "text")?.text || ""
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
  agent.resetChat(cloneUIMessages(stored))
}

/** If the user picked another chat while a task ran, snap agent + stream owner to the selected row when idle */
watch(
  () => agent.isAgentRunning.value,
  (running, wasRunning) => {
    if (wasRunning !== true || running) return
    nextTick(() => {
      if (activeChatId.value !== streamingChatId.value) {
        bindAgentToActiveChat()
      }
    })
  },
  { flush: 'post' },
)

function onNewChat() {
  if (agent.isAgentRunning.value) {
    toast.add({
      title: 'Wait for the current task',
      description: 'Stop the agent or let it finish before starting a new chat.',
      color: 'warning',
      icon: 'i-lucide-circle-pause',
    })
    return
  }

  chatSessions.value[streamingChatId.value] = agent.getMessages()
  const snapIdx = chatHistory.value.findIndex(c => c.id === streamingChatId.value)
  const snapItem = chatHistory.value[snapIdx]
  if (snapIdx !== -1 && snapItem && agent.getMessages().length > 0) {
    snapItem.title = getChatTitle(agent.getMessages())
  }

  const unusedChat = chatHistory.value.find(c =>
    getMessageCount(c.id) === 0 && c.id !== streamingChatId.value,
  )
  if (unusedChat) {
    activeChatId.value = unusedChat.id
    activeView.value = null
    activeWorkflowId.value = null
    browserRevealed.value = false
    streamingChatId.value = unusedChat.id
    agent.resetChat()
    schedulePersistChats()
    return
  }

  const newId = `chat-${Date.now()}`
  chatHistory.value.unshift({ id: newId, title: 'New chat' })
  chatSessions.value[newId] = []
  activeChatId.value = newId
  activeView.value = null
  activeWorkflowId.value = null
  browserRevealed.value = false
  streamingChatId.value = newId
  agent.resetChat()
  schedulePersistChats()
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
    agent.resetChat(cloneUIMessages(stored))
  }
  schedulePersistChats()
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
      agent.resetChat(cloneUIMessages(restored))
    }
    else {
      onNewChat()
    }
  }
}

function onSendInstruction(text: string) {
  if (agent.isAgentRunning.value || surveyLocksChat.value) return
  clearTaskFeedbackTimer()
  // If sending from a chat that isn't the streaming one, rebind first
  bindAgentToActiveChat()

  if (agent.messages.value.length === 0) {
    setActiveChatTitleFromText(text)
  }
  agent.sendInstruction(text)
}
</script>

<template>
<div class="h-screen flex ocean-page-bg overflow-hidden relative text-default">
  <AppAmbientBackground />
  <!-- Left side panel -->
  <SidePanel class="relative z-50" :expanded="sidebarExpanded" :is-browser-view="hoverSidebarActive" :chat-history="chatsWithMessages"
    :active-chat-id="activeChatId" :active-view="activeView" :active-workflow-id="activeWorkflowId"
    :pinned-workflows="wf.pinnedWorkflows.value" @toggle="sidebarExpanded = false" @expand="sidebarExpanded = true"
    @new-chat="onNewChat" @select-chat="onSelectChat" @select-workflow="onSelectWorkflow" @select-view="onSelectView"
    @rename-chat="onRenameChat" @delete-chat="onDeleteChat" @toggle-pin-workflow="onTogglePinWorkflow"
    @rename-workflow="onRenameWorkflow" @delete-workflow="onDeleteWorkflow" />

  <!-- Right side -->
  <div class="relative z-10 flex-1 flex flex-col min-w-0 gap-2 py-2 overflow-hidden">
    <!-- ═══ Landing / Welcome page ═══ -->
    <Transition name="landing-leave">
      <div v-if="showLanding" class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <ClientOnly>
          <LiquidGlassPanel variant="hero">
            <div class="flex flex-col items-center w-full px-8 py-10">
              <div class="size-14 rounded-2xl bg-primary/12 flex items-center justify-center mb-5 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
                <UIcon name="i-lucide-earth" class="size-8 text-primary" />
              </div>
              <h1 class="text-2xl font-semibold text-default mb-1.5 tracking-tight bg-gradient-to-r from-teal-700 via-cyan-600 to-teal-600 dark:from-cyan-200 dark:via-teal-200 dark:to-cyan-100 bg-clip-text text-transparent">
                Welcome to jellybyte
              </h1>
              <p class="text-sm text-muted mb-8 text-center max-w-md">Describe a task and I'll browse the web for you.</p>

              <form class="w-full max-w-lg" @submit.prevent="onLandingSend()">
                <div class="relative group">
                  <UTextarea v-model="landingInput"
                    :placeholder="taskFeedbackOpen && !taskFeedbackBannerEntered ? 'Preparing quick feedback…' : surveyLocksChat ? 'Answer the feedback in the chat panel to continue...' : agent.isAgentRunning.value ? (isViewingStreamingChat ? 'Wait for the reply or stop the agent...' : 'Agent is busy in another chat...') : 'Ask jellybyte to do something...'"
                    :disabled="agent.isAgentRunning.value || surveyLocksChat" autoresize :rows="2" :maxrows="5" size="lg"
                    class="w-full landing-input landing-glass-input" @keydown.enter.exact.prevent="onLandingSend()" />
                  <button type="submit" :disabled="!landingInput.trim() || agent.isAgentRunning.value || surveyLocksChat"
                    class="absolute bottom-3 right-3 size-9 rounded-full bg-primary text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95 shadow-md shadow-primary/25">
                    <UIcon name="i-lucide-arrow-up" class="size-4" />
                  </button>
                </div>
              </form>

              <div class="flex flex-wrap justify-center gap-2 mt-6">
                <button v-for="s in suggestions" :key="s"
                  class="px-4 py-2 rounded-full text-xs font-medium text-muted hover:text-default bg-default/50 dark:bg-white/5 hover:bg-default/75 dark:hover:bg-white/10 transition-all duration-300 border border-default/35 dark:border-white/10 hover:border-primary/35 active:scale-[0.97]"
                  :class="{ 'pointer-events-none opacity-50': agent.isAgentRunning.value || surveyLocksChat }"
                  @click="onLandingSend(s)">
                  {{ s }}
                </button>
              </div>

              <p class="text-[11px] text-dimmed mt-8 text-center">
                jellybyte can make mistakes. Verify important information.
              </p>
            </div>
          </LiquidGlassPanel>
          <template #fallback>
            <div class="flex flex-col items-center max-w-2xl w-full glass rounded-3xl px-8 py-10">
              <div class="size-14 rounded-2xl bg-primary/12 flex items-center justify-center mb-5">
                <UIcon name="i-lucide-earth" class="size-8 text-primary" />
              </div>
              <h1 class="text-2xl font-semibold text-default mb-1.5 tracking-tight">Welcome to jellybyte</h1>
              <p class="text-sm text-muted mb-8">Describe a task and I'll browse the web for you.</p>
              <form class="w-full max-w-lg" @submit.prevent="onLandingSend()">
                <div class="relative group">
                  <UTextarea v-model="landingInput"
                    :placeholder="taskFeedbackOpen && !taskFeedbackBannerEntered ? 'Preparing quick feedback…' : surveyLocksChat ? 'Answer the feedback in the chat panel to continue...' : agent.isAgentRunning.value ? (isViewingStreamingChat ? 'Wait for the reply or stop the agent...' : 'Agent is busy in another chat...') : 'Ask jellybyte to do something...'"
                    :disabled="agent.isAgentRunning.value || surveyLocksChat" autoresize :rows="2" :maxrows="5" size="lg"
                    class="w-full landing-input landing-glass-input" @keydown.enter.exact.prevent="onLandingSend()" />
                  <button type="submit" :disabled="!landingInput.trim() || agent.isAgentRunning.value || surveyLocksChat"
                    class="absolute bottom-3 right-3 size-9 rounded-full bg-primary text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95">
                    <UIcon name="i-lucide-arrow-up" class="size-4" />
                  </button>
                </div>
              </form>
              <div class="flex flex-wrap justify-center gap-2 mt-6">
                <button v-for="s in suggestions" :key="s"
                  class="px-4 py-2 rounded-full text-xs font-medium text-muted hover:text-default bg-default/60 dark:bg-white/4 hover:bg-default/80 dark:hover:bg-white/8 transition-all border border-default/40 dark:border-white/8 hover:border-primary/30 active:scale-[0.97]"
                  :class="{ 'pointer-events-none opacity-50': agent.isAgentRunning.value || surveyLocksChat }"
                  @click="onLandingSend(s)">
                  {{ s }}
                </button>
              </div>
              <p class="text-[11px] text-dimmed mt-8">
                jellybyte can make mistakes. Verify important information.
              </p>
            </div>
          </template>
        </ClientOnly>
      </div>
    </Transition>

    <!-- ═══ Browser + Chat / Other panels ═══ -->
    <template v-if="!showLanding">
      <!-- Main content area -->
      <div class="flex-1 min-h-0 mx-2 relative overflow-hidden flex flex-col">
        <!-- Browser view: viewport + agent (chat lives in agent panel as glass carousel); input fixed below -->
        <Transition name="browser-reveal">
          <div v-show="isBrowserView" class="absolute inset-0 flex flex-col gap-2 min-h-0 z-10">
            <div class="flex-1 min-h-0 relative overflow-hidden">
              <div class="absolute inset-0 browser-grid" :class="[
                sidebarExpanded ? 'browser-grid--expanded' : 'browser-grid--rail',
                tilingAnimActive ? 'browser-grid--tiling' : '',
              ]">
                <!-- Viewport tile -->
                <div class="browser-grid__viewport min-h-0">
                  <div class="w-full h-full min-h-0 rounded-2xl overflow-hidden relative flex flex-col glass-dock">
                    <BrowserViewport class="flex-1 min-h-0" :frame="screencast.currentFrame.value"
                      :is-connected="screencast.isStreaming.value" :is-loading="false"
                      :page-background-color="screencast.pageBackgroundColor.value" />
                    <div v-if="liveBrowserMismatch"
                      class="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-3 px-5 py-6 bg-black/60 dark:bg-black/70 backdrop-blur-md text-center">
                      <UIcon name="i-lucide-monitor-smartphone" class="size-10 text-white/85 shrink-0" />
                      <p class="text-sm font-medium text-white/95 max-w-[18rem] leading-snug">
                        Live browser is tied to
                        <span class="text-primary font-semibold">{{ streamingChatTitle }}</span>
                        — not this thread.
                      </p>
                      <p class="text-xs text-white/65 max-w-[19rem] leading-relaxed">
                        The sidebar can show a different chat than the one driving the agent. Open the live thread to
                        align the transcript with what you see here.
                      </p>
                      <UButton color="primary" class="mt-1" @click="openLiveBrowserChat">
                        Open live chat
                      </UButton>
                    </div>
                    <div class="absolute bottom-2.5 left-2.5">
                      <span v-if="screencast.isStreaming.value"
                        class="flex items-center gap-1.5 text-[11px] bg-black/60 backdrop-blur-sm text-white/90 px-2.5 py-1 rounded-full">
                        <span class="size-1.5 rounded-full bg-success animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Agent: thinking + glass chat carousel -->
                <div class="browser-grid__activity min-h-0 overflow-hidden min-w-0">
                  <AgentActivity v-model:task-feedback-open="taskFeedbackOpen" :messages="currentMessages"
                    :status="currentStatus" :is-agent-running="currentIsRunning" :is-connected="!!agent.sessionId.value"
                    @task-feedback-vote="onTaskFeedbackVote"
                    @task-feedback-banner-entered="taskFeedbackBannerEntered = true" />
                </div>
              </div>
            </div>

            <div class="shrink-0 flex justify-center py-1.5 px-2 sm:px-4">
              <div class="w-full max-w-3xl">
                <ChatInput :is-agent-running="currentIsRunning" :is-connected="!!agent.sessionId.value"
                  :survey-pending="taskFeedbackOpen"
                  :survey-banner-visible="taskFeedbackBannerEntered"
                  :input-locked="agent.isAgentRunning.value && !isViewingStreamingChat" @send="onSendInstruction"
                  @stop="agent.stop" />
              </div>
            </div>
          </div>
        </Transition>

        <!-- Vertical carousel: one panel at a time, mode="out-in" for sequential slide -->
        <Transition v-if="!isBrowserView" name="panel-carousel" mode="out-in">
          <div v-if="activeView === 'vault'" key="vault" class="absolute inset-0 w-full h-full">
            <VaultPanel v-model:open="vaultOpenProxy" :sidebar-expanded="sidebarExpanded" class="h-full rounded-2xl"
              @show-sidebar="sidebarExpanded = true" />
          </div>
          <div v-else-if="activeView === 'dashboard'" key="dashboard" class="absolute inset-0 w-full h-full">
            <DashboardPanel :workflows="wf.workflows.value" :pinned-ids="wf.pinnedIds.value"
              :can-pin-more="wf.canPinMore.value" @open-workflow="onOpenWorkflowFromDashboard"
              @create-workflow="onCreateWorkflowFromDashboard" @toggle-pin="onTogglePinWorkflow"
              @rename-workflow="onRenameWorkflow" @delete-workflow="onDeleteWorkflow" />
          </div>
          <div v-else-if="activeView === 'authentications'" key="authentications"
            class="absolute inset-0 w-full h-full">
            <AuthenticationsPanel />
          </div>
          <div v-else-if="activeView === 'profile'" key="profile"
            class="absolute inset-0 w-full h-full overflow-y-auto">
            <ProfilePanel @back="activeView = null" />
          </div>
          <div v-else-if="activeWorkflowId !== null" :key="`workflow-${activeWorkflowId}`"
            class="absolute inset-0 w-full h-full">
            <WorkflowPanel :workflow-title="activeWorkflowTitle" />
          </div>
        </Transition>
      </div>
    </template>
  </div>
  <BugReportButton />
</div>
</template>

<style scoped>
/* ── Landing hero (liquid glass) entrance ───────────────────────────── */
.landing-liquid-glass {
  animation: landing-hero-rise 0.88s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes landing-hero-rise {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-liquid-glass {
    animation: none;
  }
}

/* ── Landing glass input (default glow + stronger on focus) ───────────── */
@keyframes landing-input-glow-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--ui-color-primary-500), transparent 72%),
      0 0 20px -4px color-mix(in oklch, var(--ui-color-primary-500), transparent 62%);
  }
  50% {
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--ui-color-primary-500), transparent 65%),
      0 0 32px -4px color-mix(in oklch, var(--ui-color-primary-500), transparent 48%);
  }
}

@keyframes landing-input-glow-pulse-dark {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(45, 212, 191, 0.28),
      0 0 24px -6px rgba(34, 211, 238, 0.28);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(45, 212, 191, 0.4),
      0 0 40px -4px rgba(34, 211, 238, 0.42);
  }
}

.landing-glass-input :deep(textarea) {
  background: rgba(0, 0, 0, 0.02) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 1rem !important;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--ui-color-primary-500), transparent 72%),
    0 0 24px -6px color-mix(in oklch, var(--ui-color-primary-500), transparent 58%) !important;
  animation: landing-input-glow-pulse 3.2s ease-in-out infinite;
}

:global(.dark) .landing-glass-input :deep(textarea) {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(45, 212, 191, 0.22) !important;
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.28),
    0 0 28px -8px rgba(34, 211, 238, 0.32) !important;
  animation: landing-input-glow-pulse-dark 3.2s ease-in-out infinite;
}

.landing-glass-input :deep(textarea:focus) {
  border-color: var(--ui-color-primary-500) !important;
  animation: none;
  box-shadow:
    0 0 0 2px color-mix(in oklch, var(--ui-color-primary-500), transparent 55%),
    0 0 36px -4px color-mix(in oklch, var(--ui-color-primary-500), transparent 42%) !important;
}

:global(.dark) .landing-glass-input :deep(textarea:focus) {
  border-color: rgba(34, 211, 238, 0.65) !important;
  box-shadow:
    0 0 0 2px rgba(34, 211, 238, 0.25),
    0 0 44px -4px rgba(34, 211, 238, 0.45) !important;
}

@media (prefers-reduced-motion: reduce) {
  .landing-glass-input :deep(textarea) {
    animation: none;
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--ui-color-primary-500), transparent 68%),
      0 0 22px -6px color-mix(in oklch, var(--ui-color-primary-500), transparent 52%) !important;
  }

  :global(.dark) .landing-glass-input :deep(textarea) {
    animation: none;
    box-shadow:
      0 0 0 1px rgba(45, 212, 191, 0.32),
      0 0 26px -8px rgba(34, 211, 238, 0.36) !important;
  }
}

/* ── Shared: GPU-friendly, reduce paint ───────────────────────────────── */
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
.fade-enter-active {
  transition: opacity 0.35s ease-out;
}

.fade-leave-active {
  transition: opacity 0.2s ease-in;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Panel carousel: crossfade (no slide) ───────────────────────────────── */
.panel-carousel-enter-active,
.panel-carousel-leave-active {
  transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-carousel-enter-from,
.panel-carousel-leave-to {
  opacity: 0;
}

/* ── Landing exit ─────────────────────────────────────────────────────── */
.landing-leave-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.landing-leave-leave-to {
  opacity: 0;
}

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

.browser-grid--expanded .browser-grid__viewport {
  grid-row: 1;
  grid-column: 1;
}

.browser-grid--expanded .browser-grid__activity {
  grid-row: 1;
  grid-column: 2;
}

/* Icon rail: favor browser viewport width */
.browser-grid--rail {
  grid-template-columns: minmax(0, 1fr) 400px;
  grid-template-rows: 1fr;
}

.browser-grid--rail .browser-grid__viewport {
  grid-row: 1;
  grid-column: 1;
}

.browser-grid--rail .browser-grid__activity {
  grid-row: 1;
  grid-column: 2;
}

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

  .browser-reveal-enter-active,
  .browser-reveal-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>
