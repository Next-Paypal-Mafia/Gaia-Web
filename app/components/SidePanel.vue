<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkflowItem } from '~/composables/useWorkflows'

interface ChatHistoryItem {
  id: string
  title: string
}

const props = defineProps<{
  open: boolean
  chatHistory: ChatHistoryItem[]
  activeChatId: string
  activeView: 'dashboard' | 'vault' | 'authentications' | 'profile' | null
  activeWorkflowId: string | null
  pinnedWorkflows: WorkflowItem[]
}>()

const emit = defineEmits<{
  toggle: []
  newChat: []
  selectChat: [id: string]
  selectWorkflow: [id: string, title: string]
  selectView: [view: 'dashboard' | 'newchat' | 'vault' | 'authentications' | 'profile']
  renameChat: [id: string, title: string]
  deleteChat: [id: string]
  togglePinWorkflow: [id: string]
  renameWorkflow: [id: string, title: string]
  deleteWorkflow: [id: string]
}>()

const settingsOpen = ref(false)
const searchOpen = ref(false)
const settings = useSettings()

// ── Rename chat ───────────────────────────────────────────────────────────────
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

// ── Pinned workflow rename ────────────────────────────────────────────────────
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
    emit('renameWorkflow', renamingWorkflowId.value, renameWorkflowInput.value.trim())
  }
  renamingWorkflowId.value = null
}

function cancelWorkflowRename() {
  renamingWorkflowId.value = null
}

// ── Pinned workflow confirm delete ───────────────────────────────────────────
const deletingWorkflow = ref<WorkflowItem | null>(null)

function requestWorkflowDelete(wf: WorkflowItem) {
  deletingWorkflow.value = wf
}

function confirmWorkflowDelete() {
  if (deletingWorkflow.value) {
    emit('deleteWorkflow', deletingWorkflow.value.id)
  }
  deletingWorkflow.value = null
}

// ── Pinned workflow 3-dots menu ──────────────────────────────────────────────
function getPinnedMenuItems(wf: WorkflowItem): DropdownMenuItem[] {
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
        startWorkflowRename(wf.id, wf.title)
      },
    },
    {
      label: 'Unpin',
      icon: 'i-lucide-pin-off',
      onSelect() {
        emit('togglePinWorkflow', wf.id)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect() {
        requestWorkflowDelete(wf)
      },
    },
  ]
}

const workflowsSectionRef = ref<HTMLElement | null>(null)

// ── Profile ───────────────────────────────────────────────────────────────────
const initials = computed(() => {
  const name = settings.username.value.trim() || 'U'
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
})

// ── Nav button helpers ────────────────────────────────────────────────────────
function isNavActive(view: 'dashboard' | 'vault' | 'authentications' | 'profile') {
  return props.activeView === view
}

</script>

<template>
  <aside
    class="sidebar-aside flex flex-col bg-elevated rounded-2xl overflow-hidden"
    :class="open ? 'sidebar-open' : 'sidebar-closed'"
  >
    <div v-show="open" class="flex flex-col h-full w-[280px]">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-earth" class="size-5 text-primary" />
          <span class="font-bold text-sm tracking-tight">Gaia</span>
          <span class="text-[9px] font-bold tracking-wider uppercase px-1.5 py-px rounded-full bg-primary/10 text-primary leading-tight">Beta</span>
        </div>
        <UButton
          icon="i-lucide-panel-left-close"
          variant="ghost"
          size="xs"
          color="neutral"
          @click="emit('toggle')"
        />
      </div>

      <!-- Nav sections -->
      <div class="flex flex-col gap-0.5 px-2">
        <!-- Dashboard -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default transition-colors text-left"
          :class="isNavActive('dashboard') ? 'bg-default/80' : 'hover:bg-default/60'"
          @click="emit('selectView', 'dashboard')"
        >
          <UIcon
            name="i-lucide-layout-dashboard"
            class="size-4 shrink-0 transition-colors"
            :class="isNavActive('dashboard') ? 'text-primary' : 'text-muted'"
          />
          <span>Dashboard</span>
        </button>

        <!-- New Chat -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-default hover:bg-default/60 transition-colors text-left"
          @click="emit('newChat')"
        >
          <UIcon
            name="i-lucide-square-pen"
            class="size-4 shrink-0 text-muted"
          />
          <span>New Chat</span>
        </button>

        <!-- Search (overlay only — doesn't change active page) -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default transition-colors text-left hover:bg-default/60"
          @click="searchOpen = true"
        >
          <UIcon
            name="i-lucide-search"
            class="size-4 shrink-0 text-muted"
          />
          <span>Search</span>
        </button>

        <!-- Vault -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default transition-colors text-left"
          :class="isNavActive('vault') ? 'bg-default/80' : 'hover:bg-default/60'"
          @click="emit('selectView', 'vault')"
        >
          <UIcon
            name="i-lucide-archive"
            class="size-4 shrink-0 transition-colors"
            :class="isNavActive('vault') ? 'text-primary' : 'text-muted'"
          />
          <span class="flex-1">Vault</span>
          <span class="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">Beta</span>
        </button>

        <!-- Authentications -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default transition-colors text-left"
          :class="isNavActive('authentications') ? 'bg-default/80' : 'hover:bg-default/60'"
          @click="emit('selectView', 'authentications')"
        >
          <UIcon
            name="i-lucide-key-round"
            class="size-4 shrink-0 transition-colors"
            :class="isNavActive('authentications') ? 'text-primary' : 'text-muted'"
          />
          <span class="flex-1">Authentications</span>
          <span class="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">Beta</span>
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
            :class="chat.id === activeChatId && activeView === null && activeWorkflowId === null
              ? 'bg-default/80 text-default'
              : 'text-muted hover:bg-default/40 hover:text-default'"
            @click="emit('selectChat', chat.id)"
          >
            <input
              v-if="renamingChatId === chat.id"
              ref="renameInputRef"
              v-model="renameInput"
              class="flex-1 min-w-0 bg-transparent border border-muted rounded px-1.5 py-0.5 text-sm text-default outline-none focus:border-primary"
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

      <!-- Pinned workflows only -->
      <div ref="workflowsSectionRef" class="flex flex-col overflow-hidden mt-4">
        <div class="flex items-center gap-2 px-4 pb-1.5">
          <span class="text-xs text-dimmed font-medium">Workflows</span>
          <span class="text-[9px] font-semibold tracking-wide uppercase px-1.5 py-px rounded-full bg-primary/10 text-primary leading-tight">Beta</span>
        </div>

        <div v-if="pinnedWorkflows.length" class="flex flex-col gap-0.5 overflow-y-auto px-2">
          <div
            v-for="wf in pinnedWorkflows"
            :key="`pinned-${wf.id}`"
            class="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            :class="wf.id === activeWorkflowId ? 'bg-default/80 text-default' : 'text-muted hover:bg-default/40 hover:text-default'"
            @click="emit('selectWorkflow', wf.id, wf.title)"
          >
            <!-- Inline rename -->
            <input
              v-if="renamingWorkflowId === wf.id"
              ref="renameWorkflowInputRef"
              v-model="renameWorkflowInput"
              class="flex-1 min-w-0 bg-transparent border border-muted rounded px-1.5 py-0.5 text-sm text-default outline-none focus:border-primary"
              @click.stop
              @keydown.enter="confirmWorkflowRename"
              @keydown.escape="cancelWorkflowRename"
              @blur="confirmWorkflowRename"
            />
            <span v-else class="truncate flex items-center gap-2">
              <UIcon
                :name="wf.type === 'cron' ? 'i-lucide-timer' : 'i-lucide-layers'"
                class="size-3.5 shrink-0"
                :class="wf.type === 'cron' ? 'text-primary' : 'text-muted'"
              />
              {{ wf.title }}
            </span>
            <UDropdownMenu
              :items="getPinnedMenuItems(wf)"
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

        <div v-else class="px-4 py-3 text-xs text-dimmed">
          Pin workflows from the Dashboard to see them here.
        </div>
      </div>

      <!-- Spacer so footer sticks to bottom -->
      <div class="flex-1" />

      <!-- Footer: Login/Signup or Profile -->
      <div class="shrink-0 px-2 py-2 border-t border-muted">
        <!-- Logged out: Sign in button -->
        <button
          v-if="!settings.isLoggedIn.value"
          class="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          @click="settingsOpen = true"
        >
          <UIcon name="i-lucide-log-in" class="size-4 shrink-0" />
          <span>Log in / Sign up</span>
        </button>

        <!-- Logged in: Profile link -->
        <button
          v-else
          class="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left"
          :class="isNavActive('profile') ? 'bg-default/80' : 'hover:bg-default/60'"
          @click="emit('selectView', 'profile')"
        >
          <div
            v-if="settings.profilePicture.value"
            class="size-7 rounded-full shrink-0 overflow-hidden ring-1 ring-muted"
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
        :workflows="pinnedWorkflows"
        :active-chat-id="activeChatId"
        @select-chat="emit('selectChat', $event)"
        @select-workflow="(id: string) => { const wf = pinnedWorkflows.find(w => w.id === id); if (wf) emit('selectWorkflow', wf.id, wf.title) }"
      />

      <!-- Confirm delete modal -->
      <UModal
        :open="!!deletingWorkflow"
        @update:open="(val: boolean) => { if (!val) deletingWorkflow = null }"
        :ui="{ content: 'max-w-sm', body: 'p-0 sm:p-0', header: 'hidden', footer: 'hidden' }"
      >
        <template #body>
          <div class="p-6 text-center space-y-4">
            <div class="mx-auto size-12 rounded-2xl bg-error/10 flex items-center justify-center">
              <UIcon name="i-lucide-trash-2" class="size-6 text-error" />
            </div>
            <div>
              <p class="text-base font-semibold text-default">Delete workflow?</p>
              <p class="text-sm text-dimmed mt-1">
                <span class="font-medium text-default">"{{ deletingWorkflow?.title }}"</span>
                will be permanently deleted. This can't be undone.
              </p>
            </div>
            <div class="flex items-center justify-center gap-3">
              <UButton
                variant="soft"
                color="neutral"
                @click="deletingWorkflow = null"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                @click="confirmWorkflowDelete"
              >
                Delete
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-aside {
  will-change: width, opacity;
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    margin 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar-open {
  width: 280px;
  min-width: 280px;
  opacity: 1;
  margin: 0.5rem;
  margin-right: 0;
}
.sidebar-closed {
  width: 0;
  min-width: 0;
  opacity: 0;
  margin: 0;
}
</style>
