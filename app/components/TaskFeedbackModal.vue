<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  continueChat: []
  vote: [sentiment: 'positive' | 'negative']
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="false"
    :ui="{
      overlay: 'backdrop-blur-md bg-white/40 dark:bg-black/40',
      content: 'max-w-md overflow-hidden',
      body: 'p-0 sm:p-0',
      header: 'hidden',
      footer: 'hidden',
    }"
  >
    <template #body>
      <div
        class="flex flex-col gap-5 px-5 py-6 sm:px-6 bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-2xl rounded-xl"
      >
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-dimmed mb-1.5">
            Beta feedback
          </p>
          <h2 class="text-base font-semibold text-default leading-snug">
            Was the agent able to complete your task?
          </h2>
        </div>

        <div class="flex items-center justify-center gap-4">
          <button
            type="button"
            class="flex flex-col items-center gap-2 rounded-2xl px-6 py-4 min-w-[7rem] transition-all bg-black/[0.02] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
            aria-label="Yes, task completed"
            @click="emit('vote', 'positive')"
          >
            <UIcon name="i-lucide-thumbs-up" class="size-8 text-primary" />
            <span class="text-xs font-medium text-muted">Yes</span>
          </button>
          <button
            type="button"
            class="flex flex-col items-center gap-2 rounded-2xl px-6 py-4 min-w-[7rem] transition-all bg-black/[0.02] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/10 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
            aria-label="No, task not completed"
            @click="emit('vote', 'negative')"
          >
            <UIcon name="i-lucide-thumbs-down" class="size-8 text-muted" />
            <span class="text-xs font-medium text-muted">No</span>
          </button>
        </div>

        <button
          type="button"
          class="w-full text-center text-sm text-muted hover:text-default py-2.5 rounded-xl border border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
          @click="emit('continueChat')"
        >
          Continue the chat
        </button>
      </div>
    </template>
  </UModal>
</template>
