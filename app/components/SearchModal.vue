<script setup lang="ts">
interface ChatHistoryItem {
  id: string
  title: string
}

interface WorkflowItem {
  id: string
  title: string
}

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  chatHistory: ChatHistoryItem[]
  workflows: WorkflowItem[]
  activeChatId: string
}>()

const emit = defineEmits<{
  selectChat: [id: string]
  selectWorkflow: [id: string]
}>()

const searchTerm = ref('')

function fuzzyMatch(text: string, query: string): boolean {
  if (!query.trim()) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti)
    if (idx === -1) return false
    ti = idx + 1
  }
  return true
}

const filteredChats = computed(() => {
  const term = searchTerm.value
  if (!term.trim()) return props.chatHistory
  return props.chatHistory.filter((chat) => fuzzyMatch(chat.title, term))
})

const filteredWorkflows = computed(() => {
  const term = searchTerm.value
  if (!term.trim()) return props.workflows
  return props.workflows.filter((wf) => fuzzyMatch(wf.title, term))
})

const hasResults = computed(() => filteredChats.value.length > 0 || filteredWorkflows.value.length > 0)

function selectChatAndClose(chatId: string) {
  emit('selectChat', chatId)
  open.value = false
}

function selectWorkflowAndClose(workflowId: string) {
  emit('selectWorkflow', workflowId)
  open.value = false
}

watch(open, (val) => {
  if (val) {
    searchTerm.value = ''
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      overlay: 'backdrop-blur-sm bg-black/50',
      content: 'max-w-lg overflow-hidden',
      body: 'p-0 sm:p-0',
      header: 'hidden',
      footer: 'hidden',
    }"
  >
    <template #body>
      <div class="flex flex-col max-h-[80vh] overflow-hidden bg-default/95">
        <!-- Header: search input + close -->
        <div class="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
          <UInput
            v-model="searchTerm"
            placeholder="Search chats and workflows..."
            class="flex-1"
            size="md"
            :ui="{ base: 'bg-default/60 border-[var(--ui-border-muted)]' }"
            autofocus
          >
            <template #leading>
              <UIcon name="i-lucide-search" class="size-4 text-muted" />
            </template>
          </UInput>
          <button
            class="size-9 shrink-0 rounded-full bg-default/60 flex items-center justify-center text-default hover:brightness-125 transition-all"
            aria-label="Close"
            @click="open = false"
          >
            <UIcon name="i-lucide-x" class="size-[18px]" />
          </button>
        </div>

        <!-- Results list -->
        <div class="flex flex-col overflow-y-auto px-2 pb-4">
          <template v-if="filteredChats.length > 0">
            <span class="px-2 pb-1.5 text-xs text-dimmed font-medium">Chats</span>
            <div class="flex flex-col gap-0.5 mb-3">
              <button
                v-for="chat in filteredChats"
                :key="chat.id"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors w-full"
                :class="chat.id === activeChatId ? 'bg-default/80 text-default' : 'text-muted hover:bg-default/40 hover:text-default'"
                @click="selectChatAndClose(chat.id)"
              >
                <UIcon name="i-lucide-message-circle" class="size-4 shrink-0 text-muted" />
                <span class="truncate">{{ chat.title }}</span>
              </button>
            </div>
          </template>

          <template v-if="filteredWorkflows.length > 0">
            <span class="px-2 pb-1.5 text-xs text-dimmed font-medium">Workflows</span>
            <div class="flex flex-col gap-0.5">
              <button
                v-for="workflow in filteredWorkflows"
                :key="workflow.id"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors w-full text-muted hover:bg-default/40 hover:text-default"
                @click="selectWorkflowAndClose(workflow.id)"
              >
                <UIcon name="i-lucide-git-branch" class="size-4 shrink-0 text-muted" />
                <span class="truncate">{{ workflow.title }}</span>
              </button>
            </div>
          </template>

          <p
            v-if="!hasResults"
            class="px-3 py-4 text-sm text-dimmed"
          >
            No chats or workflows match your search.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
