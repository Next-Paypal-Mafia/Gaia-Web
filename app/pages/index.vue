<script setup lang="ts">
import type { UIMessage } from '~/composables/useOpenCodeAgent'

const screencast = useScreencast()
const agent = useOpenCodeAgent()

const sidebarOpen = ref(true)
const activeView = ref<'dashboard' | 'vault' | 'authentications' | null>(null)
const activeWorkflowId = ref<string | null>(null)
const activeWorkflowTitle = ref<string>('')
const activeChatId = ref('chat-1')
const chatHistory = ref([
  { id: 'chat-1', title: 'New chat' },
])
const chatSessions = ref<Record<string, UIMessage[]>>({ 'chat-1': [] })

// Whether the right panel is in the default browser/chat mode
const isBrowserView = computed(() => activeView.value === null && activeWorkflowId.value === null)

// VaultPanel uses v-model:open — proxy it through activeView
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

  const newId = `chat-${Date.now()}`
  chatHistory.value.unshift({ id: newId, title: 'New chat' })
  chatSessions.value[newId] = []
  activeChatId.value = newId
  activeView.value = null
  activeWorkflowId.value = null
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
  agent.resetChat([...(chatSessions.value[id] ?? [])])
}

function onSelectWorkflow(id: string, title: string) {
  activeWorkflowId.value = id
  activeWorkflowTitle.value = title
  activeView.value = null
}

function onSelectView(view: 'dashboard' | 'newchat' | 'search' | 'vault' | 'authentications') {
  if (view === 'newchat') {
    onNewChat()
    return
  }
  if (view === 'search') {
    activeView.value = null
    activeWorkflowId.value = null
    return
  }
  activeView.value = view as 'dashboard' | 'vault' | 'authentications'
  activeWorkflowId.value = null
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
      agent.resetChat([...(chatSessions.value[activeChatId.value] ?? [])])
    }
    else {
      onNewChat()
    }
  }
}

function onSendInstruction(text: string) {
  agent.sendInstruction(text)
}
</script>

<template>
  <div class="h-screen flex bg-default overflow-hidden">
    <!-- Left side panel -->
    <SidePanel
      :open="sidebarOpen"
      :chat-history="chatHistory"
      :active-chat-id="activeChatId"
      :active-view="activeView"
      :active-workflow-id="activeWorkflowId"
      @toggle="sidebarOpen = false"
      @new-chat="onNewChat"
      @select-chat="onSelectChat"
      @select-workflow="onSelectWorkflow"
      @select-view="onSelectView"
      @rename-chat="onRenameChat"
      @delete-chat="onDeleteChat"
    />

    <!-- Right side -->
    <div class="flex-1 flex flex-col min-w-0 gap-2 py-2">
      <!-- Browser controls row — only shown in browser/chat view -->
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
          <div class="flex-1 min-w-0">
            <BrowserControls
              :url="''"
              :is-connected="screencast.isStreaming.value"
              :is-loading="false"
            />
          </div>
        </div>
      </Transition>

      <!-- Main content area -->
      <div class="flex-1 min-h-0 mx-2 relative overflow-hidden">
        <!-- Browser viewport (default / chat view) -->
        <Transition name="fade">
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

        <!-- Vault panel -->
        <Transition name="panel-slide">
          <div
            v-if="activeView === 'vault'"
            class="absolute inset-0 w-full h-full"
          >
            <VaultPanel
              v-model:open="vaultOpenProxy"
              :sidebar-open="sidebarOpen"
              class="h-full rounded-2xl"
              @show-sidebar="sidebarOpen = true"
            />
          </div>
        </Transition>

        <!-- Dashboard panel -->
        <Transition name="panel-slide">
          <div
            v-if="activeView === 'dashboard'"
            class="absolute inset-0 w-full h-full"
          >
            <DashboardPanel />
          </div>
        </Transition>

        <!-- Authentications panel -->
        <Transition name="panel-slide">
          <div
            v-if="activeView === 'authentications'"
            class="absolute inset-0 w-full h-full"
          >
            <AuthenticationsPanel />
          </div>
        </Transition>

        <!-- Workflow panel -->
        <Transition name="panel-slide">
          <div
            v-if="activeWorkflowId !== null"
            class="absolute inset-0 w-full h-full"
          >
            <WorkflowPanel :workflow-title="activeWorkflowTitle" />
          </div>
        </Transition>
      </div>

      <!-- Chat panel — only shown in browser/chat view -->
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
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
