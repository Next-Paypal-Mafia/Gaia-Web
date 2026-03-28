<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  vote: [sentiment: "positive" | "negative"]
  bannerEntered: []
}>()
</script>

<template>
<Transition name="task-feedback-banner" @after-enter="emit('bannerEntered')">
  <div v-if="open"
    class="survey-card w-full rounded-2xl overflow-hidden border border-default/25 dark:border-white/10 bg-white/75 dark:bg-white/6 backdrop-blur-2xl shadow-lg dark:shadow-black/30 ring-1 ring-black/5 dark:ring-white/5"
    role="region" aria-labelledby="task-feedback-heading">
    <div class="h-0.5 w-full bg-linear-to-r from-primary/40 via-fuchsia-400/50 to-primary/40" />

    <div class="p-4 sm:p-5 space-y-4">
      <div class="flex gap-3 sm:gap-4">
        <div
          class="shrink-0 rounded-xl bg-primary/12 dark:bg-primary/20 p-2.5 flex items-center justify-center size-11 sm:size-12">
          <UIcon name="i-lucide-sparkles" class="size-5 sm:size-6 text-primary" />
        </div>
        <div class="min-w-0 flex-1 pt-0.5">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed mb-1">
            Beta feedback
          </p>
          <h2 id="task-feedback-heading" class="text-[15px] sm:text-base font-semibold text-default leading-snug">
            Was jellybyte able to complete this task?
          </h2>
          <p class="text-xs text-muted mt-1.5 leading-relaxed">
            Choose an option below to continue the conversation — we use this to improve the product.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        <button type="button"
          class="survey-choice group flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-default border border-default/30 dark:border-white/12 bg-default/40 dark:bg-white/4 hover:border-primary/45 hover:bg-primary/8 dark:hover:bg-primary/10 transition-all active:scale-[0.99]"
          aria-label="Yes, task completed" @click="emit('vote', 'positive')">
          <UIcon name="i-lucide-thumbs-up" class="size-5 text-primary group-hover:scale-110 transition-transform" />
          Yes, it worked
        </button>
        <button type="button"
          class="survey-choice group flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium text-default border border-default/30 dark:border-white/12 bg-default/40 dark:bg-white/4 hover:border-amber-500/35 hover:bg-amber-500/8 dark:hover:bg-amber-500/10 transition-all active:scale-[0.99]"
          aria-label="No, task not completed" @click="emit('vote', 'negative')">
          <UIcon name="i-lucide-thumbs-down"
            class="size-5 text-muted group-hover:text-default group-hover:scale-110 transition-all" />
          Not really
        </button>
      </div>
    </div>
  </div>
</Transition>
</template>

<style scoped>
.task-feedback-banner-enter-active,
.task-feedback-banner-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.task-feedback-banner-enter-from,
.task-feedback-banner-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
