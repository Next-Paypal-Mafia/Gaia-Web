<script setup lang="ts">
defineProps<{
  workflowTitle?: string
}>()
</script>

<template>
  <div class="glass-jelly flex flex-col items-center justify-center h-full w-full rounded-2xl ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15">
    <div class="flex flex-col items-center gap-5 max-w-sm text-center px-6">
      <div class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <UIcon name="i-lucide-git-branch" class="size-8 text-primary" />
      </div>
      <div class="space-y-1.5">
        <p class="text-lg font-semibold text-default">{{ workflowTitle ?? 'Workflow' }}</p>
        <p class="text-sm text-dimmed leading-relaxed">Build and run automation workflows with jellybyte's browser agent.</p>
      </div>
      <span class="text-[10px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full bg-primary/10 text-primary">Coming Soon</span>
    </div>
  </div>
</template>
