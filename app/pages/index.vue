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
const chatHistory = ref([
  { id: 'chat-1', title: 'New chat' },
])
const chatSessions = ref<Record<string, UIMessage[]>>({ 'chat-1': [] })

// Workflows + pins (max 3)
const wf = useWorkflows()

const isBrowserView = computed(() => activeView.value === null && activeWorkflowId.value === null)

// ── Landing / browser-reveal animation ───────────────────────────────────────
const browserRevealed = ref(false)
const showLanding = computed(() =>
  isBrowserView.value && agent.messages.value.length === 0 && !browserRevealed.value,
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
  // Make the chat appear in the sidebar with a meaningful title immediately.
  setActiveChatTitleFromText(msg)
  nextTick(() => {
    agent.sendInstruction(msg)
  })
}

watch(() => agent.messages.value.length, (len) => {
  if (len === 0) browserRevealed.value = false
})

// Keep active chat session + title in sync as messages stream in.
watch(
  () => agent.messages.value,
  (messages) => {
    chatSessions.value[activeChatId.value] = [...messages]
    const firstUser = messages.find(m => m.role === 'user')
    const firstText = firstUser?.parts?.find((p: any) => p.type === 'text')?.text as string | undefined
    const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
    const item = chatHistory.value[idx]
    if (firstText && idx !== -1 && item && (item.title === 'New chat' || !item.title.trim())) {
      item.title = firstText.trim().slice(0, 40) || 'New chat'
    }
  },
  { deep: true },
)

// ── Chat history helpers ─────────────────────────────────────────────────────
const chatsWithMessages = computed(() =>
  chatHistory.value.filter(c => (chatSessions.value[c.id]?.length ?? 0) > 0 || (c.id === activeChatId.value && agent.messages.value.length > 0)),
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
  if (chatId === activeChatId.value) return agent.messages.value.length
  return chatSessions.value[chatId]?.length ?? 0
}

function onNewChat() {
  const currentMessages = agent.getMessages()
  chatSessions.value[activeChatId.value] = currentMessages

  if (currentMessages.length > 0) {
    const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
    const item = chatHistory.value[idx]
    if (idx !== -1 && item) {
      item.title = getChatTitle(currentMessages)
    }
  }

  const unusedChat = chatHistory.value.find(c => getMessageCount(c.id) === 0)
  if (unusedChat) {
    activeChatId.value = unusedChat.id
    activeView.value = null
    activeWorkflowId.value = null
    browserRevealed.value = false
    agent.resetChat()
    return
  }

  const newId = `chat-${Date.now()}`
  chatHistory.value.unshift({ id: newId, title: 'New chat' })
  chatSessions.value[newId] = []
  activeChatId.value = newId
  activeView.value = null
  activeWorkflowId.value = null
  browserRevealed.value = false
  agent.resetChat()
}

function onSelectChat(id: string) {
  if (id === activeChatId.value && isBrowserView.value) return

  const currentMessages = agent.getMessages()
  chatSessions.value[activeChatId.value] = currentMessages

  if (currentMessages.length > 0) {
    const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
    const item = chatHistory.value[idx]
    if (idx !== -1 && item) {
      item.title = getChatTitle(currentMessages)
    }
  }

  activeChatId.value = id
  activeView.value = null
  activeWorkflowId.value = null

  const restored = chatSessions.value[id] ?? []
  browserRevealed.value = restored.length > 0
  agent.resetChat([...restored])
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

  chatHistory.value.splice(idx, 1)
  delete chatSessions.value[id]

  if (id === activeChatId.value) {
    const first = chatHistory.value[0]
    if (first) {
      activeChatId.value = first.id
      const restored = chatSessions.value[activeChatId.value] ?? []
      browserRevealed.value = restored.length > 0
      agent.resetChat([...restored])
    }
    else {
      onNewChat()
    }
  }
}

function onSendInstruction(text: string) {
  if (agent.messages.value.length === 0) {
    // First message in this chat: set title so it appears correctly in sidebar.
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
      <!-- Sidebar expand button when shelved -->
      <button
        v-if="!sidebarOpen"
        class="ml-2 inline-flex items-center justify-center px-2.5 py-2 rounded-xl bg-elevated/90 hover:bg-elevated text-sm text-default shadow-sm transition-colors cursor-pointer self-start"
        @click="sidebarOpen = true"
      >
        <UIcon name="i-lucide-panel-left-open" class="size-4 text-primary" />
      </button>
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
                  placeholder="Ask Gaia to do something..."
                  autoresize
                  :rows="2"
                  :maxrows="5"
                  size="lg"
                  class="w-full landing-input"
                  @keydown.enter.exact.prevent="onLandingSend()"
                />
                <button
                  type="submit"
                  :disabled="!landingInput.trim()"
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
        <!-- Browser controls row -->
        <Transition name="fade">
          <div v-show="isBrowserView" class="flex items-center">
            <button
              v-if="!sidebarOpen"
              class="flex items-center gap-2 px-4 py-2 shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              @click="sidebarOpen = true"
            >
              <UIcon name="i-lucide-earth" class="size-5 text-primary" />
              <span class="font-bold text-sm tracking-tight">Gaia</span>
            </button>
            <!-- URL/navigation controls intentionally hidden for now (future feature) -->
            <div class="flex-1 min-w-0" />
          </div>
        </Transition>

        <!-- Main content area -->
        <div class="flex-1 min-h-0 mx-2 relative overflow-hidden">
          <Transition name="browser-reveal">
            <div
              v-show="isBrowserView"
              class="absolute inset-0 w-full h-full"
            >
              <BrowserViewport
                :frame="screencast.currentFrame.value"
                :is-connected="screencast.isStreaming.value"
                :is-loading="false"
                :page-background-color="screencast.pageBackgroundColor.value"
              />
            </div>
          </Transition>

          <Transition name="panel-slide">
            <div v-if="activeView === 'vault'" class="absolute inset-0 w-full h-full">
              <VaultPanel
                v-model:open="vaultOpenProxy"
                :sidebar-open="sidebarOpen"
                class="h-full rounded-2xl"
                @show-sidebar="sidebarOpen = true"
              />
            </div>
          </Transition>

          <Transition name="panel-slide">
            <div v-if="activeView === 'dashboard'" class="absolute inset-0 w-full h-full">
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
          </Transition>

          <Transition name="panel-slide">
            <div v-if="activeView === 'authentications'" class="absolute inset-0 w-full h-full">
              <AuthenticationsPanel />
            </div>
          </Transition>

          <Transition name="panel-slide">
            <div v-if="activeView === 'profile'" class="absolute inset-0 w-full h-full overflow-y-auto">
              <ProfilePanel @back="activeView = null" />
            </div>
          </Transition>

          <Transition name="panel-slide">
            <div v-if="activeWorkflowId !== null" class="absolute inset-0 w-full h-full">
              <WorkflowPanel :workflow-title="activeWorkflowTitle" />
            </div>
          </Transition>
        </div>

        <!-- Chat panel -->
        <Transition name="fade">
          <div v-show="isBrowserView" class="h-70 shrink-0">
            <ChatPanel
              :messages="[...agent.messages.value]"
              :status="agent.status.value"
              :is-agent-running="agent.isAgentRunning.value"
              :is-connected="screencast.isStreaming.value"
              @send="onSendInstruction"
              @stop="agent.stop"
            />
          </div>
        </Transition>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Shared GPU hint for all animated layers ─────────────────────────── */
.fade-enter-active,
.fade-leave-active,
.panel-slide-enter-active,
.panel-slide-leave-active,
.landing-leave-leave-active,
.browser-reveal-enter-active,
.browser-reveal-leave-active {
  will-change: opacity, transform;
  backface-visibility: hidden;
}

/* ── Fade (browser controls row, chat panel) ─────────────────────────── */
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

/* ── Panel page transitions (Dashboard, Vault, Auth, Profile, Workflow) ─
   Hyprland style: scales slightly while sliding, creating a layered pop. */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition:
    opacity 0.4s cubic-bezier(0.05, 0.9, 0.1, 1.05),
    transform 0.45s cubic-bezier(0.05, 0.9, 0.1, 1.1); /* The Hyprland curve */
}
.panel-slide-enter-from {
  opacity: 0;
  transform: scale(0.97) translate3d(0, 30px, 0);
}
.panel-slide-leave-to {
  opacity: 0;
  transform: scale(1.03) translate3d(0, -30px, 0);
}

/* ── Landing page exit (user sends first prompt) ───────────────────────
   Closes quickly by scaling down and fading out, like dismissing a tiled window. */
.landing-leave-leave-active {
  transition:
    opacity 0.25s ease-in,
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.landing-leave-leave-to {
  opacity: 0;
  transform: scale(0.96) translate3d(0, -30px, 0);
}

/* ── Browser viewport entrance (The Hyprland "Pop") ───────────────
   Scales up from a smaller size with an overshoot bounce. */
.browser-reveal-enter-active {
  transition:
    opacity 0.4s cubic-bezier(0.05, 0.9, 0.1, 1.05),
    transform 0.5s cubic-bezier(0.05, 0.9, 0.1, 1.1);
}
.browser-reveal-enter-from {
  opacity: 0;
  transform: scale(0.92) translate3d(0, 40px, 0);
}
.browser-reveal-leave-active {
  transition: 
    opacity 0.2s ease-in,
    transform 0.25s cubic-bezier(0.4, 0, 1, 1);
}
.browser-reveal-leave-to {
  opacity: 0;
  transform: scale(0.96) translate3d(0, 20px, 0);
}
</style>