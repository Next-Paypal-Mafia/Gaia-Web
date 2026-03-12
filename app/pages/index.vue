<script setup lang="ts">
import type { UIMessage } from 'ai'

const cdp = useCDP()
const screencast = useScreencast(cdp)
const browser = useBrowserActions(cdp)
const agentTools = useAgentTools(cdp)
const agent = useAgent(agentTools.executeTool)

const toast = useToast()

const sidebarOpen = ref(true)
const vaultOpen = ref(false)
const activeChatId = ref('chat-1')
const chatHistory = ref([
  { id: 'chat-1', title: 'New chat' },
])
const chatSessions = ref<Record<string, UIMessage[]>>({ 'chat-1': [] })

function getChatTitle(messages: UIMessage[]): string {
  const first = messages.find(m => m.role === 'user')
  if (!first) return 'New chat'
  const text = first.parts?.find((p: any) => p.type === 'text')?.text || ''
  return text.trim().slice(0, 40) || 'New chat'
}

function onNewChat() {
  const currentMessages = agent.getMessages()
  chatSessions.value[activeChatId.value] = currentMessages

  if (currentMessages.length > 0) {
    const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
    if (idx !== -1) {
      chatHistory.value[idx].title = getChatTitle(currentMessages)
    }
  }

  const newId = `chat-${Date.now()}`
  chatHistory.value.unshift({ id: newId, title: 'New chat' })
  chatSessions.value[newId] = []
  activeChatId.value = newId
  agent.resetChat()
}

function onSelectChat(id: string) {
  if (id === activeChatId.value) return

  const currentMessages = agent.getMessages()
  chatSessions.value[activeChatId.value] = currentMessages

  if (currentMessages.length > 0) {
    const idx = chatHistory.value.findIndex(c => c.id === activeChatId.value)
    if (idx !== -1) {
      chatHistory.value[idx].title = getChatTitle(currentMessages)
    }
  }

  activeChatId.value = id
  agent.resetChat(chatSessions.value[id] ?? [])
}

function onRenameChat(id: string, title: string) {
  const idx = chatHistory.value.findIndex(c => c.id === id)
  if (idx !== -1) {
    chatHistory.value[idx].title = title
  }
}

function onDeleteChat(id: string) {
  const idx = chatHistory.value.findIndex(c => c.id === id)
  if (idx === -1) return

  chatHistory.value.splice(idx, 1)
  delete chatSessions.value[id]

  if (id === activeChatId.value) {
    if (chatHistory.value.length > 0) {
      activeChatId.value = chatHistory.value[0].id
      agent.resetChat(chatSessions.value[activeChatId.value] ?? [])
    }
    else {
      onNewChat()
    }
  }
}

onMounted(async () => {
  try {
    const data = await $fetch('/api/cdp')
    if (!data?.webSocketDebuggerUrl) {
      toast.add({
        title: 'Connection failed',
        description: 'Could not find Chrome debug endpoint. Run: bun run dev:chrome',
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
      return
    }

    await cdp.connect(data.webSocketDebuggerUrl)
    await cdp.enableDomains()
    await screencast.start()

    toast.add({
      title: 'Connected',
      description: 'Browser viewport is live.',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (e: any) {
    toast.add({
      title: 'Connection error',
      description: e.message || 'Failed to connect to Chrome',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
})

function onNavigate(url: string) {
  browser.navigate(url)
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
      :vault-open="vaultOpen"
      @toggle="sidebarOpen = false"
      @new-chat="onNewChat"
      @select-chat="onSelectChat"
      @rename-chat="onRenameChat"
      @delete-chat="onDeleteChat"
      @vault="vaultOpen = !vaultOpen"
    />

    <!-- Right side: browser/vault + chat stacked -->
    <div class="flex-1 flex flex-col min-w-0 gap-2 py-2">
      <!-- Top row: collapsed logo (when sidebar hidden) + browser controls - fades when vault open -->
      <Transition name="fade">
        <div v-show="!vaultOpen" class="flex items-center">
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
              :url="browser.currentUrl.value"
              :is-connected="cdp.connected.value"
              :is-loading="browser.isLoading.value"
              @navigate="onNavigate"
              @back="browser.goBack"
              @forward="browser.goForward"
              @reload="browser.reload"
            />
          </div>
        </div>
      </Transition>

      <!-- Browser viewport or Vault panel - vault slides in from top -->
      <div class="flex-1 min-h-0 mx-2 relative overflow-hidden">
        <Transition name="fade">
          <div
            v-show="!vaultOpen"
            class="absolute inset-0 w-full h-full"
          >
            <BrowserViewport
              :frame="screencast.currentFrame.value"
              :is-connected="cdp.connected.value"
              :is-loading="browser.isLoading.value"
              :page-background-color="screencast.pageBackgroundColor.value"
            />
          </div>
        </Transition>
        <Transition name="vault-slide">
          <div
            v-show="vaultOpen"
            class="absolute inset-0 w-full h-full"
          >
            <VaultPanel
              v-model:open="vaultOpen"
              :sidebar-open="sidebarOpen"
              class="h-full rounded-2xl"
              @show-sidebar="sidebarOpen = true"
            />
          </div>
        </Transition>
      </div>

      <!-- Chat panel (below browser) -->
      <div class="h-[280px] shrink-0">
        <ChatPanel
          :messages="agent.messages.value"
          :status="agent.status.value"
          :is-agent-running="agent.isAgentRunning.value"
          :is-connected="cdp.connected.value"
          @send="onSendInstruction"
          @stop="agent.stop"
        />
      </div>
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

.vault-slide-enter-active,
.vault-slide-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.vault-slide-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.vault-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
