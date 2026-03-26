<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkflowItem, WorkflowType } from '~/composables/useWorkflows'

const props = defineProps<{
  workflows: WorkflowItem[]
  pinnedIds: string[]
  canPinMore: boolean
}>()

const emit = defineEmits<{
  openWorkflow: [id: string, title: string]
  createWorkflow: [type: WorkflowType]
  togglePin: [id: string]
  renameWorkflow: [id: string, title: string]
  deleteWorkflow: [id: string]
}>()

function isPinned(id: string) {
  return props.pinnedIds.includes(id)
}

function pinButtonClass(id: string) {
  if (isPinned(id)) return 'bg-primary/10 text-primary'
  if (props.canPinMore) return 'bg-default/60 text-muted hover:text-default'
  return 'bg-default/40 text-muted opacity-60 cursor-not-allowed'
}

// ── Inline rename ────────────────────────────────────────────────────────────
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(id: string, currentTitle: string) {
  renamingId.value = id
  renameValue.value = currentTitle
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function confirmRename() {
  if (renamingId.value && renameValue.value.trim()) {
    emit('renameWorkflow', renamingId.value, renameValue.value.trim())
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ── Confirm delete ───────────────────────────────────────────────────────────
const deletingWorkflow = ref<WorkflowItem | null>(null)

function requestDelete(wf: WorkflowItem) {
  deletingWorkflow.value = wf
}

function confirmDelete() {
  if (deletingWorkflow.value) {
    emit('deleteWorkflow', deletingWorkflow.value.id)
  }
  deletingWorkflow.value = null
}

// ── 3-dots menu ──────────────────────────────────────────────────────────────
function getMenuItems(wf: WorkflowItem): DropdownMenuItem[] {
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
        startRename(wf.id, wf.title)
      },
    },
    {
      label: isPinned(wf.id) ? 'Unpin' : 'Pin to sidebar',
      icon: isPinned(wf.id) ? 'i-lucide-pin-off' : 'i-lucide-pin',
      onSelect() {
        emit('togglePin', wf.id)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect() {
        requestDelete(wf)
      },
    },
  ]
}
</script>

<template>
  <div class="glass-jelly h-full w-full rounded-2xl overflow-hidden flex flex-col ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15">
    <!-- Header -->
    <div class="px-6 py-5 border-b border-black/6 dark:border-white/6 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold text-default leading-tight">Dashboard</h1>
        <p class="text-xs text-dimmed">Your workflows, automations, and CRON jobs</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          size="sm"
          icon="i-lucide-plus"
          @click="emit('createWorkflow', 'workflow')"
        >
          New workflow
        </UButton>
        <UButton
          size="sm"
          variant="soft"
          icon="i-lucide-timer"
          @click="emit('createWorkflow', 'cron')"
        >
          New CRON
        </UButton>
      </div>
    </div>

    <!-- Tiles -->
    <div class="flex-1 overflow-y-auto">
      <div class="px-6 py-6">
        <div v-if="!workflows.length" class="py-12 text-center text-muted">
          <div class="mx-auto size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-layout-dashboard" class="size-7 text-primary" />
          </div>
          <p class="text-sm font-medium text-default">No workflows yet</p>
          <p class="text-xs text-dimmed mt-1">Create a workflow or a CRON job to get started.</p>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="wf in workflows"
            :key="wf.id"
            class="group relative text-left rounded-2xl bg-black/2 dark:bg-white/3 hover:bg-black/4 dark:hover:bg-white/6 border border-black/6 dark:border-white/6 hover:border-primary/20 transition-all p-4 cursor-pointer"
            @click="renamingId !== wf.id && emit('openWorkflow', wf.id, wf.title)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <UIcon
                    :name="wf.type === 'cron' ? 'i-lucide-timer' : 'i-lucide-layers'"
                    class="size-4.5 text-primary"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <!-- Inline rename input -->
                  <input
                    v-if="renamingId === wf.id"
                    ref="renameInputRef"
                    v-model="renameValue"
                    class="w-full bg-transparent border border-muted rounded-lg px-2 py-1 text-sm text-default outline-none focus:border-primary"
                    @click.stop
                    @keydown.enter="confirmRename"
                    @keydown.escape="cancelRename"
                    @blur="confirmRename"
                  />
                  <template v-else>
                    <p class="text-sm font-semibold text-default truncate">{{ wf.title }}</p>
                    <p class="text-xs text-dimmed mt-0.5">
                      <span v-if="wf.type === 'cron'" class="inline-flex items-center gap-1">
                        <UIcon name="i-lucide-timer" class="size-3" />
                        CRON job
                      </span>
                      <span v-else>Workflow</span>
                    </p>
                  </template>
                </div>
              </div>

              <!-- Actions: pin + menu -->
              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="size-8 rounded-lg flex items-center justify-center transition-all"
                  :class="pinButtonClass(wf.id)"
                  :title="isPinned(wf.id) ? 'Unpin from sidebar' : (canPinMore ? 'Pin to sidebar' : 'You can pin up to 3')"
                  @click.stop="emit('togglePin', wf.id)"
                >
                  <UIcon :name="isPinned(wf.id) ? 'i-lucide-pin-off' : 'i-lucide-pin'" class="size-3.5" />
                </button>
                <UDropdownMenu
                  :items="getMenuItems(wf)"
                  :content="{ align: 'end', side: 'bottom' }"
                >
                  <UButton
                    icon="i-lucide-ellipsis-vertical"
                    variant="ghost"
                    size="xs"
                    color="neutral"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop
                  />
                </UDropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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
              @click="confirmDelete"
            >
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
