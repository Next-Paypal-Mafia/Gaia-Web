<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkflowItem } from '~/composables/useWorkflows'

interface ChatHistoryItem {
  id: string
  title: string
}

const props = defineProps<{
  /** Full width sidebar with labels; false = icon rail only */
  expanded: boolean
  isBrowserView?: boolean
  chatHistory: ChatHistoryItem[]
  activeChatId: string
  activeView: 'dashboard' | 'vault' | 'authentications' | 'profile' | null
  activeWorkflowId: string | null
  pinnedWorkflows: WorkflowItem[]
}>()

const emit = defineEmits<{
  toggle: []
  expand: []
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

// New Chat is an action (not a routed view), so we track a local selected state
// to let the sidebar highlight it like other nav items.
const newChatSelected = ref(false)

onMounted(() => {
  // Default to highlighting "New Chat" when landing in the main browser/chat view.
  if (props.activeView === null && props.activeWorkflowId === null) {
    newChatSelected.value = true
  }
})

const railChatMenuItems = computed<DropdownMenuItem[]>(() =>
  props.chatHistory.map(chat => ({
    label: chat.title,
    onSelect() {
      newChatSelected.value = false
      emit('selectChat', chat.id)
    },
  })),
)

const railWorkflowMenuItems = computed<DropdownMenuItem[]>(() =>
  props.pinnedWorkflows.map(wf => ({
    label: wf.title,
    onSelect() {
      emit('selectWorkflow', wf.id, wf.title)
    },
  })),
)

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
const sidePanelAsideRef = ref<HTMLElement | null>(null)

/** Portaled dropdowns sit outside the aside; mouseleave would collapse the hover rail and break anchoring. */
const sidebarMenusOpenCount = ref(0)

function trackSidebarDropdownOpen(open: boolean) {
  sidebarMenusOpenCount.value += open ? 1 : -1
  if (sidebarMenusOpenCount.value < 0)
    sidebarMenusOpenCount.value = 0
}

function onAsidePointerLeave() {
  if (!props.isBrowserView)
    return
  if (sidebarMenusOpenCount.value > 0)
    return
  emit('toggle')
}

watch(sidebarMenusOpenCount, (count, prev) => {
  if (!props.isBrowserView || prev === undefined)
    return
  if (prev <= 0 || count > 0)
    return
  nextTick(() => {
    const el = sidePanelAsideRef.value
    if (el && !el.matches(':hover'))
      emit('toggle')
  })
})

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

const isNewChatActive = computed(() => {
  return newChatSelected.value && props.activeView === null && props.activeWorkflowId === null
})

watch(
  () => [props.activeView, props.activeWorkflowId, props.activeChatId] as const,
  ([view, wfId, chatId], [prevView, prevWfId, prevChatId]) => {
    // Any navigation away clears the "New Chat" highlight
    if (view !== prevView || wfId !== prevWfId || chatId !== prevChatId) {
      // Keep it selected only when we are effectively in the "fresh chat" state.
      if (view !== null || wfId !== null) {
        newChatSelected.value = false
      }
    }
  },
)

</script>

<template>
  <div
    class="relative shrink-0 transition-[width] duration-300 ease-out"
    :style="{ width: expanded && !isBrowserView ? 'calc(280px + 0.5rem)' : 'calc(4.25rem + 0.5rem)' }"
  >
    <aside
      ref="sidePanelAsideRef"
      class="sidebar-aside jelly-block flex flex-col rounded-2xl overflow-hidden absolute top-0 bottom-0 left-0 z-50"
      :class="[
        expanded ? 'sidebar-expanded' : 'sidebar-rail',
        isBrowserView ? 'jelly-block--over-bright' : '',
        expanded && isBrowserView ? 'ring-1 ring-fuchsia-500/15 dark:ring-pink-400/20' : '',
      ]"
      @mouseenter="isBrowserView && emit('expand')"
      @mouseleave="onAsidePointerLeave"
    >
    <!-- Icon rail (default) -->
    <div
      v-show="!expanded"
      class="flex flex-col h-full w-full items-center py-2 gap-0.5"
    >
      <UTooltip :text="!isBrowserView ? 'Expand sidebar' : 'jellybyte'">
        <button
          type="button"
          class="group/logo flex items-center justify-center size-10 rounded-xl hover:bg-black/4 dark:hover:bg-white/6 text-default transition-colors mb-2"
          @click="!isBrowserView && emit('expand')"
        >
          <UIcon name="i-lucide-earth" class="size-5 text-primary transition-opacity" :class="!isBrowserView ? 'block group-hover/logo:hidden' : ''" />
          <UIcon v-if="!isBrowserView" name="i-lucide-panel-left-open" class="size-5 text-primary hidden group-hover/logo:block transition-opacity" />
        </button>
      </UTooltip>

      <UTooltip text="Dashboard">
        <button
          type="button"
          class="sidebar-rail-btn"
          :class="isNavActive('dashboard') ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-black/4 dark:hover:bg-white/6'"
          @click="emit('selectView', 'dashboard')"
        >
          <UIcon name="i-lucide-layout-dashboard" class="size-4.5" />
        </button>
      </UTooltip>

      <UTooltip text="New chat">
        <button
          type="button"
          class="sidebar-rail-btn"
          :class="isNewChatActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-black/4 dark:hover:bg-white/6'"
          @click="() => { newChatSelected = true; emit('newChat') }"
        >
          <UIcon name="i-lucide-square-pen" class="size-4.5" />
        </button>
      </UTooltip>

      <UTooltip text="Search">
        <button
          type="button"
          class="sidebar-rail-btn text-muted hover:bg-black/4 dark:hover:bg-white/6"
          @click="searchOpen = true"
        >
          <UIcon name="i-lucide-search" class="size-4.5" />
        </button>
      </UTooltip>

      <UTooltip text="Vault">
        <button
          type="button"
          class="sidebar-rail-btn"
          :class="isNavActive('vault') ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-black/4 dark:hover:bg-white/6'"
          @click="emit('selectView', 'vault')"
        >
          <UIcon name="i-lucide-archive" class="size-4.5" />
        </button>
      </UTooltip>

      <UTooltip text="Authentications">
        <button
          type="button"
          class="sidebar-rail-btn"
          :class="isNavActive('authentications') ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-black/4 dark:hover:bg-white/6'"
          @click="emit('selectView', 'authentications')"
        >
          <UIcon name="i-lucide-key-round" class="size-4.5" />
        </button>
      </UTooltip>

      <UDropdownMenu
        :items="railChatMenuItems"
        :content="{ align: 'start', side: 'right', positionStrategy: 'fixed' }"
        :disabled="!chatHistory.length"
        @update:open="trackSidebarDropdownOpen"
      >
        <button
          type="button"
          title="Chats"
          class="sidebar-rail-btn text-muted hover:bg-black/4 dark:hover:bg-white/6 disabled:opacity-40"
          :disabled="!chatHistory.length"
        >
          <UIcon name="i-lucide-messages-square" class="size-4.5" />
        </button>
      </UDropdownMenu>

      <UDropdownMenu
        :items="railWorkflowMenuItems"
        :content="{ align: 'start', side: 'right', positionStrategy: 'fixed' }"
        :disabled="!pinnedWorkflows.length"
        @update:open="trackSidebarDropdownOpen"
      >
        <button
          type="button"
          title="Workflows"
          class="sidebar-rail-btn text-muted hover:bg-white/6 disabled:opacity-40"
          :disabled="!pinnedWorkflows.length"
        >
          <UIcon name="i-lucide-layers" class="size-4.5" />
        </button>
      </UDropdownMenu>

      <div class="flex-1 min-h-2" />

      <UTooltip v-if="!settings.isLoggedIn.value" text="Log in">
        <button
          type="button"
          class="sidebar-rail-btn text-primary hover:bg-primary/10"
          @click="settingsOpen = true"
        >
          <UIcon name="i-lucide-log-in" class="size-4.5" />
        </button>
      </UTooltip>
      <UTooltip v-else text="Profile">
        <button
          type="button"
          class="sidebar-rail-btn p-0 overflow-hidden ring-1 ring-transparent hover:ring-primary/40"
          :class="isNavActive('profile') ? 'ring-primary/50' : ''"
          @click="emit('selectView', 'profile')"
        >
          <div
            v-if="settings.profilePicture.value"
            class="size-8 rounded-lg overflow-hidden"
          >
            <img
              :src="settings.profilePicture.value"
              :alt="settings.username.value"
              class="size-full object-cover"
            />
          </div>
          <div
            v-else
            class="size-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
            style="background: linear-gradient(135deg, var(--ui-color-primary-400), var(--ui-color-primary-600))"
          >
            {{ initials }}
          </div>
        </button>
      </UTooltip>
    </div>

    <div v-show="expanded" class="flex flex-col h-full w-70">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-earth" class="size-5 text-primary" />
          <span class="font-bold text-sm tracking-tight">jellybyte</span>
          <span class="text-[9px] font-bold tracking-wider uppercase px-1.5 py-px rounded-full bg-primary/10 text-primary leading-tight">Beta</span>
        </div>
        <UButton
          v-if="!isBrowserView"
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
          :class="isNavActive('dashboard') ? 'bg-primary/10' : 'hover:bg-black/4 dark:hover:bg-white/6'"
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
          class="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-default transition-colors text-left"
          :class="isNewChatActive ? 'bg-primary/10' : 'hover:bg-black/4 dark:hover:bg-white/6'"
          @click="() => { newChatSelected = true; emit('newChat') }"
        >
          <UIcon
            name="i-lucide-square-pen"
            class="size-4 shrink-0 transition-colors"
            :class="isNewChatActive ? 'text-primary' : 'text-muted'"
          />
          <span>New Chat</span>
        </button>

        <!-- Search (overlay only — doesn't change active page) -->
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-default transition-colors text-left hover:bg-black/4 dark:hover:bg-white/6"
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
          :class="isNavActive('vault') ? 'bg-primary/10' : 'hover:bg-black/4 dark:hover:bg-white/6'"
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
          :class="isNavActive('authentications') ? 'bg-primary/10' : 'hover:bg-black/4 dark:hover:bg-white/6'"
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
        <span class="px-4 pb-1.5 text-xs text-dimmed font-medium">Chats</span>
        <div class="flex flex-col gap-0.5 overflow-y-auto px-2">
          <div
            v-for="chat in chatHistory"
            :key="chat.id"
            class="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors"
            :class="chat.id === activeChatId && activeView === null && activeWorkflowId === null
              ? 'bg-primary/10 text-default'
              : 'text-muted hover:bg-black/4 dark:hover:bg-white/6 hover:text-default'"
            @click="() => { newChatSelected = false; emit('selectChat', chat.id) }"
          >
            <!-- selecting a chat clears New Chat selection -->
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
              :content="{ align: 'start', side: 'bottom', positionStrategy: 'fixed' }"
              @update:open="trackSidebarDropdownOpen"
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
            :class="wf.id === activeWorkflowId ? 'bg-primary/10 text-default' : 'text-muted hover:bg-black/4 dark:hover:bg-white/6 hover:text-default'"
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
            <span v-else class="min-w-0 flex-1 flex items-center gap-2">
              <UIcon
                name="i-lucide-layers"
                class="size-3.5 shrink-0"
                :class="wf.id === activeWorkflowId ? 'text-primary' : 'text-muted'"
              />
              <span class="truncate">{{ wf.title }}</span>
            </span>
            <div class="shrink-0 relative flex items-center justify-center size-6 ml-1">
              <UIcon
                v-if="wf.type === 'cron'"
                name="i-lucide-timer"
                class="absolute size-3.5 text-muted transition-opacity group-hover:opacity-0 pointer-events-none"
              />
              <UDropdownMenu
                :items="getPinnedMenuItems(wf)"
                :content="{ align: 'start', side: 'bottom', positionStrategy: 'fixed' }"
                @update:open="trackSidebarDropdownOpen"
              >
                <UButton
                  icon="i-lucide-ellipsis"
                  variant="ghost"
                  size="xs"
                  color="neutral"
                  class="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity relative z-10"
                  @click.stop
                />
              </UDropdownMenu>
            </div>
          </div>
        </div>

        <div v-else class="px-4 py-3 text-xs text-dimmed">
          Pin workflows from the Dashboard to see them here.
        </div>
      </div>

      <!-- Spacer so footer sticks to bottom -->
      <div class="flex-1" />

      <!-- Footer: Login/Signup or Profile -->
      <div class="shrink-0 px-2 py-2 border-t border-black/6 dark:border-white/6">
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
          :class="isNavActive('profile') ? 'bg-primary/10' : 'hover:bg-black/4 dark:hover:bg-white/6'"
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
    </aside>
  </div>
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
.sidebar-expanded {
  width: 280px;
  min-width: 280px;
  opacity: 1;
  margin: 0.5rem;
  margin-right: 0;
}
.sidebar-rail {
  width: 4.25rem;
  min-width: 4.25rem;
  opacity: 1;
  margin: 0.5rem;
  margin-right: 0;
}

.sidebar-rail-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  transition: color 0.15s ease, background-color 0.15s ease;
}
</style>
