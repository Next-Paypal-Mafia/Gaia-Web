<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

interface ChatHistoryItem {
  id: string
  title: string
}

defineProps<{
  open: boolean
  chatHistory: ChatHistoryItem[]
  activeChatId: string
  vaultOpen?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  newChat: []
  selectChat: [id: string]
  selectWorkflow: [id: string]
  renameChat: [id: string, title: string]
  deleteChat: [id: string]
  vault: []
}>()

const settingsOpen = ref(false)
const searchOpen = ref(false)
const settings = useSettings()

const renamingChatId = ref<string | null>(null)
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(chatId: string, currentTitle: string) {
  renamingChatId.value = chatId
  renameInput.value = currentTitle
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function confirmRename() {
  if (renamingChatId.value && renameInput.value.trim()) {
    emit('renameChat', renamingChatId.value, renameInput.value.trim())
  }
  renamingChatId.value = null
}

function cancelRename() {
  renamingChatId.value = null
}

function getChatMenuItems(chat: ChatHistoryItem): DropdownMenuItem[] {
  return [
    {
      label: 'Share',
      icon: 'i-lucide-share-2',
      disabled: true,
    },
    {
      label: 'Rename',
      icon: 'i-lucide-pencil',
      onSelect() {
        startRename(chat.id, chat.title)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect() {
        emit('deleteChat', chat.id)
      },
    },
  ]
}

const workflows = ref([
  { id: 'wf-1', title: 'Daily standup summary' },
  { id: 'wf-2', title: 'Code review checklist' },
  { id: 'wf-3', title: 'Deploy to production' },
])

const renamingWorkflowId = ref<string | null>(null)
const renameWorkflowInput = ref('')
const renameWorkflowInputRef = ref<HTMLInputElement | null>(null)

function startWorkflowRename(id: string, currentTitle: string) {
  renamingWorkflowId.value = id
  renameWorkflowInput.value = currentTitle
  nextTick(() => {
    renameWorkflowInputRef.value?.focus()
    renameWorkflowInputRef.value?.select()
  })
}

function confirmWorkflowRename() {
  if (renamingWorkflowId.value && renameWorkflowInput.value.trim()) {
    const idx = workflows.value.findIndex(w => w.id === renamingWorkflowId.value)
    if (idx !== -1) {
      workflows.value[idx].title = renameWorkflowInput.value.trim()
    }
  }
  renamingWorkflowId.value = null
}

function cancelWorkflowRename() {
  renamingWorkflowId.value = null
}

function deleteWorkflow(id: string) {
  const idx = workflows.value.findIndex(w => w.id === id)
  if (idx !== -1) {
    workflows.value.splice(idx, 1)
  }
}

function getWorkflowMenuItems(workflow: { id: string, title: string }): DropdownMenuItem[] {
  return [
    {
      label: 'Share',
      icon: 'i-lucide-share-2',
      disabled: true,
    },
    {
      label: 'Rename',
      icon: 'i-lucide-pencil',
      onSelect() {
        startWorkflowRename(workflow.id, workflow.title)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect() {
        deleteWorkflow(workflow.id)
      },
    },
  ]
}

const workflowsSectionRef = ref<HTMLElement | null>(null)

function onSelectWorkflow(id: string) {
  emit('selectWorkflow', id)
  nextTick(() => {
    workflowsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

const initials = computed(() => {
  const name = settings.username.value.trim() || 'U'
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
})
</script>

<template>
  <aside
    class="flex flex-col bg-elevated rounded-2xl m-2 mr-0 overflow-hidden transition-all duration-300 ease-in-out"
    :class="open ? 'w-[280px] min-w-[280px] opacity-100' : 'w-0 min-w-0 opacity-0 m-0'"
  >
    <div v-show="open" class="flex flex-col h-full w-[280px]">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 pt-4 pb-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-earth" class="size-5 text-primary" />
          <span class="font-bold text-sm tracking-tight">Gaia</span>
        </div>
        <UButton
          icon="i-lucide-panel-left-close"
          variant="ghost"
          size="xs"
          color="neutral"
          @click="emit('toggle')"
        />
      </div>

      <!-- Sections -->
      <div class="flex flex-col gap-0.5 px-2">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default hover:bg-default/60 transition-colors text-left"
        >
          <UIcon name="i-lucide-layout-dashboard" class="size-4 text-muted" />
          <span>Dashboard</span>
        </button>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default hover:bg-default/60 transition-colors text-left"
          @click="emit('newChat')"
        >
          <UIcon name="i-lucide-square-pen" class="size-4 text-muted" />
          <span>New Chat</span>
        </button>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
          :class="searchOpen ? 'bg-default/80 text-default' : 'text-muted hover:bg-default/60 hover:text-default'"
          @click="searchOpen = true"
        >
          <UIcon
            name="i-lucide-search"
            class="size-4 shrink-0"
            :class="searchOpen ? 'text-primary' : 'text-muted'"
          />
          <span>Search</span>
        </button>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
          :class="vaultOpen ? 'bg-default/80 text-default' : 'text-muted hover:bg-default/60 hover:text-default'"
          @click="emit('vault')"
        >
          <UIcon
            name="i-lucide-archive"
            class="size-4 shrink-0"
            :class="vaultOpen ? 'text-primary' : 'text-muted'"
          />
          <span>Vault</span>
        </button>
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default hover:bg-default/60 transition-colors text-left"
        >
          <UIcon name="i-lucide-key-round" class="size-4 text-muted" />
          <span>Authentications</span>
        </button>
      </div>

      <!-- Chat history -->
      <div class="flex flex-col overflow-hidden mt-4">
        <span class="px-4 pb-1.5 text-xs text-dimmed font-medium">Chat</span>
        <div class="flex flex-col gap-0.5 overflow-y-auto px-2">
          <div
            v-for="chat in chatHistory"
            :key="chat.id"
            class="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            :class="chat.id === activeChatId && !vaultOpen ? 'bg-default/80 text-default' : 'text-muted hover:bg-default/40 hover:text-default'"
            @click="emit('selectChat', chat.id)"
          >
            <input
              v-if="renamingChatId === chat.id"
              ref="renameInputRef"
              v-model="renameInput"
              class="flex-1 min-w-0 bg-transparent border border-[var(--ui-border)] rounded px-1.5 py-0.5 text-sm text-default outline-none focus:border-[var(--ui-color-primary-500)]"
              @click.stop
              @keydown.enter="confirmRename"
              @keydown.escape="cancelRename"
              @blur="confirmRename"
            />
            <span v-else class="truncate">{{ chat.title }}</span>
            <UDropdownMenu
              :items="getChatMenuItems(chat)"
              :content="{ align: 'start', side: 'bottom' }"
            >
              <UButton
                icon="i-lucide-ellipsis"
                variant="ghost"
                size="xs"
                color="neutral"
                class="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>

      <!-- Workflows -->
      <div ref="workflowsSectionRef" class="flex flex-col flex-1 overflow-hidden mt-4">
        <span class="px-4 pb-1.5 text-xs text-dimmed font-medium">Workflows</span>
        <div class="flex flex-col gap-0.5 flex-1 overflow-y-auto px-2">
          <div
            v-for="workflow in workflows"
            :key="workflow.id"
            class="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-muted hover:bg-default/40 hover:text-default"
          >
            <input
              v-if="renamingWorkflowId === workflow.id"
              ref="renameWorkflowInputRef"
              v-model="renameWorkflowInput"
              class="flex-1 min-w-0 bg-transparent border border-[var(--ui-border)] rounded px-1.5 py-0.5 text-sm text-default outline-none focus:border-[var(--ui-color-primary-500)]"
              @click.stop
              @keydown.enter="confirmWorkflowRename"
              @keydown.escape="cancelWorkflowRename"
              @blur="confirmWorkflowRename"
            />
            <span v-else class="truncate">{{ workflow.title }}</span>
            <UDropdownMenu
              :items="getWorkflowMenuItems(workflow)"
              :content="{ align: 'start', side: 'bottom' }"
            >
              <UButton
                icon="i-lucide-ellipsis"
                variant="ghost"
                size="xs"
                color="neutral"
                class="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>

      <!-- Profile row -->
      <div class="shrink-0 px-2 py-2 border-t border-[var(--ui-border-muted)]">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-default/60 transition-colors text-left"
          @click="settingsOpen = true"
        >
          <div
            v-if="settings.profilePicture.value"
            class="size-7 rounded-full shrink-0 overflow-hidden ring-1 ring-[var(--ui-border-muted)]"
          >
            <img
              :src="settings.profilePicture.value"
              :alt="settings.username.value"
              class="size-full object-cover"
            />
          </div>
          <div
            v-else
            class="size-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style="background: linear-gradient(135deg, var(--ui-color-primary-400), var(--ui-color-primary-600))"
          >
            {{ initials }}
          </div>
          <span class="text-sm text-default truncate">{{ settings.username.value }}</span>
        </button>
      </div>

      <SettingsModal v-model:open="settingsOpen" />
      <SearchModal
        v-model:open="searchOpen"
        :chat-history="chatHistory"
        :workflows="workflows"
        :active-chat-id="activeChatId"
        @select-chat="emit('selectChat', $event)"
        @select-workflow="onSelectWorkflow"
      />
    </div>
  </aside>
</template>
