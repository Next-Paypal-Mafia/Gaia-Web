<script setup lang="ts">
import type { BrowserAgentBudget, UIMessage } from '~/composables/useOpenCodeAgent'
import {
  buildPersistedPayload,
  cloneUIMessages,
  persistChatState,
  readChatBootstrap,
} from '~/composables/useChatLocalPersistence'
import { useServerCompatibility } from '~/composables/useServerCompatibility'

const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const toast = useToast()

const boot = readChatBootstrap()
const activeChatId = ref(boot.activeChatId)
const streamingChatId = ref(boot.streamingChatId)
const focusedBrowserMessageId = ref<string | null>(null)
const chatHistory = ref(boot.chatHistory)
const chatSessions = ref<Record<string, UIMessage[]>>(boot.chatSessions)
const browserRevealed = ref(boot.browserRevealed)
const viewportHidden = ref(false)
const dismissedTaskFeedbackAssistantIds = ref(new Set(boot.dismissedFeedbackIds))

const screencast = useScreencast()
const agent = useOpenCodeAgent()
const usage = useUsage()
const settings = useSettings()
const { t } = useI18n()

const limitReachedOpen = ref(false)
const limitReachedTitle = computed(() => t('limit_reached_title', 'Limit reached'))
const limitReachedDescription = computed(() =>
  settings.isLoggedIn.value
    ? t('limit_reached_pro', 'You have used all available requests for your current plan. Upgrade to a premium tier to continue browsing without limits.')
    : t('limit_reached_anon', 'Anonymous users are limited to 1 request. Sign in or create an account to get more requests and save your chat history.'),
)

const serverCompatibility = useServerCompatibility()
const authToken = ref<string | undefined>(undefined)
let authStateSubscription: { unsubscribe: () => void } | null = null
const viewportDebugEnabled = import.meta.dev
type UsageDebugTokenBreakdown = {
  input: number
  output: number
  reasoning: number
  cache: {
    read: number
    write: number
  }
  total: number
}

type UsageDebugPayload = {
  sessionId: string
  opencodeSessionId: string
  activeRunId: string | null
  generatedAt: number
  totals: {
    cost: number
    tokens: UsageDebugTokenBreakdown
  }
  messages: Array<{
    messageId: string
    runId: string | null
    role: string
    providerID: string | null
    modelID: string | null
    mode: string | null
    finish: string | null
    time: {
      created: number | null
      completed: number | null
    }
    cost: number | null
    tokens: UsageDebugTokenBreakdown
    limits: {
      context: number | null
      output: number | null
    }
    stepFinishes: Array<{
      partId: string | null
      reason: string | null
      cost: number | null
      tokens: UsageDebugTokenBreakdown
    }>
  }>
}

const viewportDebug = ref<null | {
  viewport: {
    runId: string | null
    agentId: string | null
    contextId: string | null
    targetId: string | null
    browserSessionName: string | null
  }
  activeRunId: string | null
  processing: boolean
  runs: Array<{
    runId: string
    status: string
    contextId: string | null
    browserSessionName: string
    browserContextId: string | null
    targetId: string | null
    usesBrowser: boolean
    browserAgentBudget: BrowserAgentBudget
  }>
} | null>(null)
const usageDebug = ref<UsageDebugPayload | null>(null)
const viewportDebugRuns = computed(() => {
  const debug = viewportDebug.value
  if (!debug) return [] as Array<{
    runId: string
    status: string
    contextId: string | null
    browserSessionName: string
    browserContextId: string | null
    targetId: string | null
    usesBrowser: boolean
    browserAgentBudget: BrowserAgentBudget
  }>

  return debug.runs.map((run) => ({
    ...run,
    browserAgentBudget: agent.runs.value[run.runId]?.browserAgentBudget ?? run.browserAgentBudget,
  }))
})
const viewportDebugPrimaryRun = computed(() => {
  const debug = viewportDebug.value
  const runs = viewportDebugRuns.value
  if (!debug || runs.length === 0) return null

  return runs.find(run => run.runId === debug.viewport.runId)
    ?? runs.find(run => run.runId === debug.activeRunId)
    ?? runs[0]
    ?? null
})
const usageDebugJson = computed(() =>
  usageDebug.value ? JSON.stringify(usageDebug.value, null, 2) : "",
)
const usageDebugLatestMessage = computed(() => {
  const messages = usageDebug.value?.messages ?? []
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.role === "assistant" || (message?.tokens.total ?? 0) > 0) return message
  }
  return null
})
let viewportDebugTimer: ReturnType<typeof setInterval> | null = null
let usageDebugTimer: ReturnType<typeof setInterval> | null = null
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

const focusedBrowserMismatch = computed(() => {
  const runId = agent.focusedBrowserRunId.value
  if (!runId) return null

  const messages = currentMessages.value
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.runId !== runId) continue
    const mismatch = message.parts.find(part => part.type === 'diagnostic-browser-mismatch')
    if (mismatch)
      return mismatch as { reason?: string, command?: string, browserSessionName?: string }
  }

  return null
})

type BrowserViewEntry = {
  key: string
  runId: string
  browserTaskId: string | null
  messageId: string
  label: string
}

function findFocusedBrowserEntry(entries: BrowserViewEntry[]): BrowserViewEntry | null {
  const focusedRunId = agent.focusedBrowserRunId.value
  if (!focusedRunId) return null

  const focusedBrowserTaskId = agent.focusedBrowserTaskId.value ?? null
  return entries.find(entry =>
    entry.runId === focusedRunId
    && (entry.browserTaskId ?? null) === focusedBrowserTaskId,
  ) ?? null
}

const currentBrowserViewEntries = computed<BrowserViewEntry[]>(() => {
  if (!isViewingStreamingChat.value)
    return []

  const entries: BrowserViewEntry[] = []
  const seen = new Set<string>()

  for (const message of currentMessages.value) {
    if (message.role !== "assistant" || !message.runId)
      continue

    const run = agent.runs.value[message.runId]
    if (!run)
      continue

    for (const browserTask of Object.values(run.browserTasks)) {
      if (!browserTask.browserTaskId || !browserTask.contextId)
        continue
      if (browserTask.messageId && browserTask.messageId !== message.id)
        continue

      const key = `${message.runId}:${browserTask.browserTaskId}`
      if (seen.has(key))
        continue
      seen.add(key)

      entries.push({
        key,
        runId: message.runId,
        browserTaskId: browserTask.browserTaskId,
        messageId: browserTask.messageId ?? message.id,
        label: browserTask.label ?? "Browser subagent",
      })
    }
  }

  for (const [runId, run] of Object.entries(agent.runs.value)) {
    for (const browserTask of Object.values(run.browserTasks)) {
      if (!browserTask.browserTaskId || !browserTask.contextId)
        continue
      const key = `${runId}:${browserTask.browserTaskId}`
      if (seen.has(key))
        continue
      seen.add(key)
      entries.push({
        key,
        runId,
        browserTaskId: browserTask.browserTaskId,
        messageId: browserTask.messageId ?? `run-${runId}`,
        label: browserTask.label ?? "Browser subagent",
      })
    }
  }

  return entries
})

const liveBrowserMismatch = computed(() =>
  isBrowserView.value
  && activeChatId.value !== streamingChatId.value
  && screencast.isStreaming.value,
)
const browserMismatchFallback = 'Browser session mapping could not be verified for this focused run.'

const streamingChatTitle = computed(() => {
  const current = chatHistory.value.find(chat => chat.id === streamingChatId.value)
  return current?.title?.trim() || "your live chat"
})

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

async function refreshViewportDebug() {
  if (!viewportDebugEnabled) return
  if (!agent.sessionId.value) {
    viewportDebug.value = null
    return
  }

  try {
    const debug = await agent.requestViewportDebug()
    if (!debug) {
      viewportDebug.value = null
      return
    }

    const runs = Object.values(agent.runs.value).map(run => ({
      runId: run.runId,
      status: run.status,
      contextId: run.contextId,
      browserSessionName: run.browserSessionName ?? "",
      browserContextId: run.browserContextId ?? null,
      targetId: run.targetId ?? null,
      usesBrowser: run.usesBrowser,
      browserAgentBudget: run.browserAgentBudget ?? {
        maxBrowserAgents: debug.browserAgentBudget.maxBrowserAgents,
        activeBrowserTasks: debug.browserAgentBudget.activeBrowserAgents,
        remainingBrowserTasks: debug.browserAgentBudget.remainingBrowserAgents,
      },
    }))

    const focusedRunId = debug.viewport?.agentId
      ? (Object.values(agent.runs.value).find(run =>
          run.latestBrowserTaskId === debug.viewport?.agentId
          || Object.values(run.browserTasks).some(task => task.browserTaskId === debug.viewport?.agentId),
        )?.runId ?? null)
      : null

    viewportDebug.value = {
      viewport: {
        runId: focusedRunId,
        agentId: debug.viewport?.agentId ?? null,
        contextId: debug.viewport?.contextId ?? null,
        targetId: debug.viewport?.targetId ?? null,
        browserSessionName: debug.viewport?.browserSessionName ?? null,
      },
      activeRunId: agent.activeRunId.value,
      processing: debug.processing,
      runs,
    }
  }
  catch {
    // ignore dev-only debug failures
  }
}

async function refreshUsageDebug() {
  if (!viewportDebugEnabled) return
  const apiUrl = config.public.serverUrl
  const sid = agent.sessionId.value
  if (!apiUrl || !sid) {
    usageDebug.value = null
    return
  }

  const headers: Record<string, string> = {}
  if (authToken.value) headers.Authorization = `Bearer ${authToken.value}`

  try {
    const res = await fetch(`${apiUrl}/sessions/${sid}/usage`, {
      headers,
      credentials: authToken.value ? "omit" : "include",
    })
    if (!res.ok) return
    usageDebug.value = {
      ...(await res.json()),
      activeRunId: agent.activeRunId.value,
    }
  }
  catch {
    // ignore dev-only debug failures
  }
}

function startViewportDebugPolling() {
  if (!viewportDebugEnabled) return
  if (viewportDebugTimer) clearInterval(viewportDebugTimer)
  viewportDebugTimer = setInterval(() => {
    void refreshViewportDebug()
  }, 3000)
}

function stopViewportDebugPolling() {
  if (viewportDebugTimer) {
    clearInterval(viewportDebugTimer)
    viewportDebugTimer = null
  }
}

function startUsageDebugPolling() {
  if (!viewportDebugEnabled) return
  if (usageDebugTimer) clearInterval(usageDebugTimer)
  usageDebugTimer = setInterval(() => {
    void refreshUsageDebug()
  }, 3000)
}

function stopUsageDebugPolling() {
  if (usageDebugTimer) {
    clearInterval(usageDebugTimer)
    usageDebugTimer = null
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

const clientBooting = ref(false)

async function bootClient(forceCompatibilityCheck = false) {
  if (clientBooting.value) return
  clientBooting.value = true

  try {
    const compatibilityState = await serverCompatibility.check(forceCompatibilityCheck)
    if (compatibilityState.status === "incompatible") {
      console.warn(`[jellybyte] API Version Mismatch: expected ${serverCompatibility.expectedVersion}, got ${compatibilityState.serverVersion}. Error: ${compatibilityState.error}`)
      return
    }

    const apiUrl = config.public.serverUrl
    if (!apiUrl) {
      console.warn('[jellybyte] SERVER_URL is not set — skipping session creation')
      return
    }

    if (compatibilityState.status === "unreachable") {
      console.warn(`[jellybyte] Could not verify backend API version before startup. Error: ${compatibilityState.error}`)
    }

    if (agent.sessionId.value) return

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    authToken.value = token

    await agent.connect(apiUrl, token)
    void refreshViewportDebug()
    void refreshUsageDebug()
    startViewportDebugPolling()
    startUsageDebugPolling()
  }
  finally {
    clientBooting.value = false
  }
}

async function reconnectClientForAuthChange(nextToken?: string) {
  authToken.value = nextToken

  if (clientBooting.value)
    return

  if (agent.sessionId.value)
    await agent.disconnect()

  await bootClient(true)
}

onMounted(() => {
  void bootClient()

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextToken = session?.access_token
    if (nextToken === authToken.value)
      return
    void reconnectClientForAuthChange(nextToken)
  })

  authStateSubscription = data.subscription
})

watch(
  () => agent.focusedBrowserRunId.value,
  (runId) => {
    if (!runId) {
      focusedBrowserMessageId.value = null
    }
    if (!agent.sessionId.value) return
    if (runId) {
      const apiUrl = config.public.serverUrl
      if (apiUrl)
        screencast.start(apiUrl, agent.sessionId.value, authToken.value)
    }
    else {
      screencast.stop()
    }
    void refreshViewportDebug()
    void refreshUsageDebug()
  },
)

watch(
  () => [agent.sessionId.value, agent.activeRunId.value, agent.runs.value],
  () => {
    void refreshViewportDebug()
    void refreshUsageDebug()
  },
  { deep: true },
)

onUnmounted(async () => {
  authStateSubscription?.unsubscribe()
  authStateSubscription = null
  if (tilingAnimTimer) clearTimeout(tilingAnimTimer)
  clearTaskFeedbackTimer()
  flushPersistChatsSync()
  stopViewportDebugPolling()
  stopUsageDebugPolling()
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

  if (!usage.canRequest.value) {
    limitReachedOpen.value = true
    return
  }

  const msg = (text ?? landingInput.value).trim()
  if (!msg) return
  clearTaskFeedbackTimer()
  landingInput.value = ''
  browserRevealed.value = true
  viewportHidden.value = true
  setActiveChatTitleFromText(msg)
  bindAgentToActiveChat()
  nextTick(() => {
    agent.sendInstruction(msg)
  })
}

// Auto-show viewport when browser tools are seen
watch(() => agent.messages.value, (msgs) => {
  const hasBrowserTool = msgs.some(m =>
    m.role === 'assistant' &&
    m.parts.some(p =>
      typeof p.type === 'string' &&
      p.type.startsWith('tool-') &&
      !p.type.includes('websearch') &&
      !p.type.includes('Exa')
    )
  )
  if (hasBrowserTool) {
    viewportHidden.value = false
  } else if (msgs.length > 0) {
    // If we have messages but none use browser tools, keep it hidden by default
    // viewportHidden.value = true // Optional: do we want to hide it if we switch to a chat without tools?
  }
}, { deep: true })

watch(() => agent.messages.value.length, (len) => {
  if (len === 0 && isViewingStreamingChat.value) browserRevealed.value = false
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
  void agent.clearBrowserFocus()
  focusedBrowserMessageId.value = null
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
    viewportHidden.value = true
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
  viewportHidden.value = true
  streamingChatId.value = newId
  agent.resetChat()
  schedulePersistChats()
}

function onSelectChat(id: string) {
  void agent.clearBrowserFocus()
  focusedBrowserMessageId.value = null
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
  viewportHidden.value = true // Watcher will flip this to false if browser tools found

  // Rebind the agent only when idle
  if (!agent.isAgentRunning.value) {
    streamingChatId.value = id
    agent.resetChat(cloneUIMessages(stored))
  }
  schedulePersistChats()
}

function openLiveBrowserChat() {
  onSelectChat(streamingChatId.value)
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

  if (!usage.canRequest.value) {
    limitReachedOpen.value = true
    return
  }

  clearTaskFeedbackTimer()
  // If sending from a chat that isn't the streaming one, rebind first
  bindAgentToActiveChat()

  if (agent.messages.value.length === 0) {
    setActiveChatTitleFromText(text)
  }
  agent.sendInstruction(text)
}

async function focusBrowserEntry(
  payload: { runId: string, browserTaskId?: string | null, messageId: string },
  showUnavailableToast = true,
) {
  const ok = await agent.focusBrowserRun(payload.runId, payload.browserTaskId ?? null)
  if (!ok) {
    if (showUnavailableToast) {
      toast.add({
        title: 'Browser not available',
        description: 'That run does not have an active browser context to display.',
        color: 'warning',
        icon: 'i-lucide-monitor-off',
      })
    }
    return false
  }
  focusedBrowserMessageId.value = payload.messageId
  return true
}

watch(
  [currentBrowserViewEntries, isBrowserView, () => agent.focusedBrowserRunId.value, () => agent.focusedBrowserTaskId.value],
  ([entries, browserView]) => {
    if (!browserView || entries.length === 0) return

    const focusedEntry = findFocusedBrowserEntry(entries)
    if (focusedEntry) {
      if (focusedBrowserMessageId.value !== focusedEntry.messageId)
        focusedBrowserMessageId.value = focusedEntry.messageId
      return
    }

    if (agent.focusedBrowserRunId.value || agent.focusedBrowserTaskId.value)
      return

    const defaultEntry = entries[entries.length - 1]
    if (!defaultEntry) return

    void focusBrowserEntry(defaultEntry, false)
  },
  { flush: 'post' },
)

async function onFocusBrowserRun(payload: { runId: string, browserTaskId?: string | null, messageId: string }) {
  await focusBrowserEntry(payload)
}
</script>

<template>
<div class="h-screen flex bg-default overflow-hidden relative jelly-root">
  <!-- Jellyfish ambient glow orbs -->
  <div class="jelly-orbs">
    <div class="jelly-orb jelly-orb--1" />
    <div class="jelly-orb jelly-orb--2" />
    <div class="jelly-orb jelly-orb--3" />
  </div>
  <!-- Left side panel -->
  <SidePanel :expanded="sidebarExpanded" :chat-history="chatsWithMessages" :active-chat-id="activeChatId"
    :active-view="activeView" :active-workflow-id="activeWorkflowId" :pinned-workflows="wf.pinnedWorkflows.value"
    @toggle="sidebarExpanded = false" @expand="sidebarExpanded = true" @new-chat="onNewChat" @select-chat="onSelectChat"
    @select-workflow="onSelectWorkflow" @select-view="onSelectView" @rename-chat="onRenameChat"
    @delete-chat="onDeleteChat" @toggle-pin-workflow="onTogglePinWorkflow" @rename-workflow="onRenameWorkflow"
    @delete-workflow="onDeleteWorkflow" />

  <!-- Right side -->
  <div class="flex-1 flex flex-col min-w-0 gap-2 py-2 overflow-hidden">
    <!-- ═══ Landing / Welcome page ═══ -->
    <Transition name="landing-leave">
      <div v-if="showLanding" class="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div class="flex flex-col items-center max-w-2xl w-full glass rounded-3xl px-8 py-10">
          <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <UIcon name="i-lucide-earth" class="size-8 text-primary" />
          </div>
          <h1 class="text-2xl font-semibold text-default mb-1.5 tracking-tight">{{ t('welcome') }}</h1>
          <p class="text-sm text-muted mb-8">{{ t('welcome_desc') }}</p>

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
      </div>
    </Transition>

    <!-- ═══ Browser + Chat / Other panels ═══ -->
    <template v-if="!showLanding">
      <div class="flex-1 min-h-0 mx-2 relative overflow-hidden flex flex-col">
        <Transition name="browser-reveal">
          <div v-show="isBrowserView" class="absolute inset-0 flex flex-col gap-2 min-h-0 z-10">
            <div class="flex-1 min-h-0 relative overflow-hidden">
              <div class="absolute inset-0 browser-grid" :class="[
                sidebarExpanded ? 'browser-grid--expanded' : 'browser-grid--rail',
                tilingAnimActive ? 'browser-grid--tiling' : '',
                viewportHidden ? 'browser-grid--viewport-hidden' : '',
              ]">
                <div class="browser-grid__viewport min-h-0">
                  <div class="w-full h-full min-h-0 rounded-2xl overflow-hidden relative flex flex-col">
                    <LazyBrowserViewport class="flex-1 min-h-0" :frame="screencast.currentFrame.value"
                      :is-connected="screencast.isStreaming.value" :is-loading="false"
                      :page-background-color="screencast.pageBackgroundColor.value" />
                    <div v-if="liveBrowserMismatch"
                      class="absolute inset-0 z-15 flex flex-col items-center justify-center gap-3 px-5 py-6 bg-black/60 dark:bg-black/70 backdrop-blur-md text-center">
                      <UIcon name="i-lucide-monitor-smartphone" class="size-10 text-white/85 shrink-0" />
                      <p class="text-sm font-medium text-white/95 max-w-[18rem] leading-snug">
                        Live browser is tied to
                        <span class="text-primary font-semibold">{{ streamingChatTitle }}</span>
                        — not this thread.
                      </p>
                      <p class="text-xs text-white/65 max-w-76 leading-relaxed">
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
                    <div v-if="focusedBrowserMismatch"
                      class="absolute bottom-2.5 right-2.5 z-13 max-w-xs rounded-2xl border border-warning/35 bg-warning/12 px-3 py-2.5 text-[11px] text-warning shadow-lg backdrop-blur-md">
                      <div class="flex items-start gap-2">
                        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
                        <div class="min-w-0">
                          <p class="font-semibold">Browser session warning</p>
                          <p class="mt-0.5 text-warning/90 leading-relaxed">{{ focusedBrowserMismatch.reason ||
                            browserMismatchFallback }}</p>
                          <p v-if="focusedBrowserMismatch.browserSessionName" class="mt-1 text-warning/80">
                            Expected session: <span class="font-mono">{{ focusedBrowserMismatch.browserSessionName
                              }}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div v-if="viewportDebugEnabled && viewportDebug"
                      class="absolute top-2.5 right-2.5 z-12 w-72 rounded-2xl border border-black/10 bg-white/88 p-3 text-[11px] text-black/80 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/65 dark:text-white/80">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold tracking-wide text-[10px] uppercase text-primary/90">Viewport
                          Debug</span>
                        <span class="text-[10px] text-dimmed">dev only</span>
                      </div>
                      <div class="mt-2 space-y-1.5">
                        <p><span class="text-dimmed">Focused run:</span> {{ viewportDebug.viewport.runId || 'none' }}
                        </p>
                        <p><span class="text-dimmed">Browser session:</span> {{
                          viewportDebug.viewport.browserSessionName || 'none' }}</p>
                        <p><span class="text-dimmed">Context:</span> {{ viewportDebug.viewport.contextId || 'none' }}
                        </p>
                        <p><span class="text-dimmed">Target:</span> {{ viewportDebug.viewport.targetId || 'none' }}</p>
                        <p><span class="text-dimmed">Active run:</span> {{ viewportDebug.activeRunId || 'none' }}</p>
                        <p><span class="text-dimmed">Browser budget:</span> {{ viewportDebugPrimaryRun ?
                          `${viewportDebugPrimaryRun.browserAgentBudget.remainingBrowserTasks} remaining /
                          ${viewportDebugPrimaryRun.browserAgentBudget.maxBrowserAgents} max` : 'none' }}</p>
                        <p><span class="text-dimmed">Active browser tasks:</span> {{
                          viewportDebugPrimaryRun?.browserAgentBudget.activeBrowserTasks ?? 0 }}</p>
                      </div>
                      <div v-if="viewportDebugRuns.length"
                        class="mt-3 border-t border-black/8 pt-2 dark:border-white/10">
                        <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dimmed">Runs</p>
                        <div class="max-h-36 space-y-1 overflow-auto pr-1">
                          <div v-for="run in viewportDebugRuns" :key="run.runId"
                            class="rounded-xl bg-black/4 px-2 py-1.5 dark:bg-white/6">
                            <p class="truncate font-medium">{{ run.runId }}</p>
                            <p class="text-dimmed">{{ run.status }} · {{ run.browserSessionName }}</p>
                            <p class="truncate text-dimmed">ctx {{ run.contextId || 'none' }} · target {{ run.targetId
                              || 'none' }}</p>
                            <p class="text-dimmed">budget {{ run.browserAgentBudget.remainingBrowserTasks }} remain · {{
                              run.browserAgentBudget.activeBrowserTasks }} active / {{
                                run.browserAgentBudget.maxBrowserAgents }} max</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="viewportDebugEnabled && usageDebug"
                      class="absolute top-2.5 left-2.5 z-12 w-80 max-h-88 overflow-hidden rounded-2xl border border-black/10 bg-white/88 p-3 text-[11px] text-black/80 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-black/65 dark:text-white/80">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold tracking-wide text-[10px] uppercase text-primary/90">Usage
                          Debug</span>
                        <span class="text-[10px] text-dimmed">dev only</span>
                      </div>
                      <div class="mt-2 space-y-1.5">
                        <p><span class="text-dimmed">Messages:</span> {{ usageDebug.messages.length }}</p>
                        <p><span class="text-dimmed">Active run:</span> {{ usageDebug.activeRunId || 'none' }}</p>
                        <p><span class="text-dimmed">Total tokens:</span> {{ usageDebug.totals.tokens.total }}</p>
                        <p><span class="text-dimmed">Input / output:</span> {{ usageDebug.totals.tokens.input }} / {{
                          usageDebug.totals.tokens.output }}</p>
                        <p><span class="text-dimmed">Reasoning:</span> {{ usageDebug.totals.tokens.reasoning }}</p>
                        <p><span class="text-dimmed">Cache:</span> {{ usageDebug.totals.tokens.cache.read }} read · {{
                          usageDebug.totals.tokens.cache.write }} write</p>
                        <p><span class="text-dimmed">Cost:</span> {{ usageDebug.totals.cost }}</p>
                      </div>
                      <div v-if="usageDebugLatestMessage"
                        class="mt-3 rounded-xl bg-black/4 px-2.5 py-2 dark:bg-white/6">
                        <p class="font-semibold">Latest message</p>
                        <p class="mt-1 truncate text-dimmed">{{ usageDebugLatestMessage.messageId }}</p>
                        <p class="text-dimmed">run {{ usageDebugLatestMessage.runId || 'none' }} · {{
                          usageDebugLatestMessage.role }}</p>
                        <p class="text-dimmed">{{ usageDebugLatestMessage.providerID || 'unknown' }} / {{
                          usageDebugLatestMessage.modelID || 'unknown' }}</p>
                        <p class="text-dimmed">tokens {{ usageDebugLatestMessage.tokens.total }} · context {{
                          usageDebugLatestMessage.tokens.input }} / {{ usageDebugLatestMessage.limits.context ?? 'n/a'
                          }}</p>
                      </div>
                      <details
                        class="mt-3 rounded-xl border border-black/8 bg-black/3 px-2.5 py-2 dark:border-white/8 dark:bg-white/4">
                        <summary class="cursor-pointer select-none font-medium">Raw payload</summary>
                        <pre
                          class="mt-2 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word text-[10px] leading-relaxed">
                          {{ usageDebugJson }}</pre>
                      </details>
                    </div>
                  </div>
                </div>

                <div class="browser-grid__activity min-h-0 overflow-hidden min-w-0">
                  <LazyAgentActivity v-model:task-feedback-open="taskFeedbackOpen" :messages="currentMessages"
                    :status="currentStatus" :is-agent-running="currentIsRunning" :is-connected="!!agent.sessionId.value"
                    :viewport-hidden="viewportHidden" :browser-view-entries="currentBrowserViewEntries"
                    :focused-browser-run-id="agent.focusedBrowserRunId.value"
                    :focused-browser-task-id="agent.focusedBrowserTaskId.value"
                    :focused-browser-message-id="focusedBrowserMessageId" @task-feedback-vote="onTaskFeedbackVote"
                    @task-feedback-banner-entered="taskFeedbackBannerEntered = true"
                    @toggle-viewport="viewportHidden = !viewportHidden" @focus-browser-run="onFocusBrowserRun" />
                </div>
              </div>
            </div>

            <div class="shrink-0 flex justify-center py-1.5 px-2 sm:px-4">
              <div class="w-full max-w-3xl">
                <LazyChatInput :is-agent-running="currentIsRunning" :is-connected="!!agent.sessionId.value"
                  :survey-pending="taskFeedbackOpen" :survey-banner-visible="taskFeedbackBannerEntered"
                  :input-locked="agent.isAgentRunning.value && !isViewingStreamingChat" @send="onSendInstruction"
                  @stop="agent.stop" />
              </div>
            </div>
          </div>
        </Transition>

        <Transition v-if="!isBrowserView" name="panel-carousel" mode="out-in">
          <div v-if="activeView === 'vault'" key="vault" class="absolute inset-0 w-full h-full">
            <LazyVaultPanel v-model:open="vaultOpenProxy" :sidebar-expanded="sidebarExpanded" class="h-full rounded-2xl"
              @show-sidebar="sidebarExpanded = true" />
          </div>
          <div v-else-if="activeView === 'dashboard'" key="dashboard" class="absolute inset-0 w-full h-full">
            <LazyDashboardPanel :workflows="wf.workflows.value" :pinned-ids="wf.pinnedIds.value"
              :can-pin-more="wf.canPinMore.value" @open-workflow="onOpenWorkflowFromDashboard"
              @create-workflow="onCreateWorkflowFromDashboard" @toggle-pin="onTogglePinWorkflow"
              @rename-workflow="onRenameWorkflow" @delete-workflow="onDeleteWorkflow" />
          </div>
          <div v-else-if="activeView === 'authentications'" key="authentications"
            class="absolute inset-0 w-full h-full">
            <LazyAuthenticationsPanel />
          </div>
          <div v-else-if="activeView === 'profile'" key="profile"
            class="absolute inset-0 w-full h-full overflow-y-auto">
            <LazyProfilePanel @back="activeView = null" />
          </div>
          <div v-else-if="activeWorkflowId !== null" :key="`workflow-${activeWorkflowId}`"
            class="absolute inset-0 w-full h-full">
            <LazyWorkflowPanel :workflow-title="activeWorkflowTitle" />
          </div>
        </Transition>
      </div>
    </template>

    <BugReportButton />
    <LanguageSwitchPrompt />

    <UModal v-model:open="limitReachedOpen" :ui="{
      content: 'max-w-md',
      body: 'p-0 sm:p-0',
      header: 'hidden',
      footer: 'hidden',
    }">
      <template #body>
        <div class="p-8 text-center glass-jelly border-0 rounded-3xl relative overflow-hidden">
          <div class="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent pointer-events-none" />

          <div class="relative z-10 space-y-5">
            <div
              class="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-[0_0_20px_rgba(var(--ui-color-primary-500),0.1)]">
              <UIcon name="i-lucide-zap" class="size-8 text-primary" />
            </div>

            <div>
              <h3 class="text-xl font-bold text-default tracking-tight">{{ limitReachedTitle }}</h3>
              <p class="text-sm text-dimmed mt-2 leading-relaxed">{{ limitReachedDescription }}</p>
            </div>

            <div class="pt-2 flex flex-col gap-3">
              <UButton block size="lg" color="primary" class="font-semibold shadow-lg shadow-primary/20"
                @click="onSelectView('profile'); limitReachedOpen = false">
                {{ settings.isLoggedIn.value ? 'Upgrade Plan' : 'Sign in / Sign up' }}
              </UButton>
              <UButton block size="lg" variant="ghost" color="neutral" @click="limitReachedOpen = false">
                Maybe later
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</div>
</template>

<style scoped>
/* ── Landing glass input ──────────────────────────────────────────────── */
.landing-glass-input :deep(textarea) {
  background: rgba(0, 0, 0, 0.02) !important;
  border: 1px solid rgba(139, 92, 246, 0.15) !important;
  border-radius: 1rem !important;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
  /* Glow by default */
  box-shadow: 0 0 32px 6px rgba(138, 92, 246, 0.267) !important;
}

:global(.dark) .landing-glass-input :deep(textarea) {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: rgba(139, 92, 246, 0.25) !important;
  box-shadow: 0 0 40px -12px rgba(139, 92, 246, 0.2) !important;
}

.landing-glass-input :deep(textarea:focus) {
  border-color: var(--ui-color-primary-500) !important;
  box-shadow: 0 0 24px -6px rgba(139, 92, 246, 0.3) !important;
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

/* Hidden viewport state: Center the chat with a max width of 800px */
.browser-grid--viewport-hidden {
  grid-template-columns: 0px 1fr !important;
  gap: 0 !important;
}

.browser-grid--viewport-hidden .browser-grid__viewport {
  display: none;
}

.browser-grid--viewport-hidden .browser-grid__activity {
  grid-column: 2 !important;
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
