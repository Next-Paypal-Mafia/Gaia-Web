<script setup lang="ts">
defineProps<{
  workflowTitle?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full w-full rounded-2xl bg-elevated">
    <UIcon name="i-lucide-git-branch" class="size-10 text-muted mb-4" />
    <p class="text-base font-semibold text-default">{{ workflowTitle ?? 'Workflow' }}</p>
    <p class="text-sm text-muted mt-1">Coming soon</p>
  </div>
</template>
