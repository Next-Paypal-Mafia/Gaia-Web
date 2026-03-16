<script setup lang="ts">
defineProps<{
  frame: string | null
  isConnected: boolean
  isLoading: boolean
  pageBackgroundColor: string | null
}>()

const viewportRef = ref<HTMLDivElement>()
</script>

<template>
  <div
    ref="viewportRef"
    class="relative w-full h-full overflow-hidden flex items-center justify-center rounded-2xl transition-colors duration-700"
    :style="{ backgroundColor: pageBackgroundColor ?? '#0a0a0a' }"
  >
    <!-- Connected with frame -->
    <img
      v-if="frame"
      :src="frame"
      alt="Browser viewport"
      class="w-full h-full object-contain"
      draggable="false"
    >

    <!-- Connected but no frame yet -->
    <div
      v-else-if="isConnected"
      class="flex flex-col items-center gap-4 text-muted"
    >
      <div class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <UIcon
          name="i-lucide-monitor"
          class="size-8 text-primary animate-pulse"
        />
      </div>
      <div class="text-center">
        <p class="text-sm font-medium text-default mb-0.5">Loading browser...</p>
        <p class="text-xs text-dimmed">Waiting for content to appear</p>
      </div>
    </div>

    <!-- Not connected -->
    <div
      v-else
      class="flex flex-col items-center gap-5 text-muted max-w-md text-center px-6"
    >
      <div class="size-20 rounded-3xl bg-elevated flex items-center justify-center border border-muted">
        <UIcon
          name="i-lucide-globe"
          class="size-10 text-muted/50"
        />
      </div>
      <div class="space-y-1.5">
        <p class="text-base font-semibold text-default">
          Browser not connected
        </p>
        <p class="text-sm text-dimmed leading-relaxed">
          Start Chrome with remote debugging enabled to see the browser view here.
        </p>
      </div>
    </div>

    <!-- Loading overlay -->
    <div
      v-if="isLoading && isConnected"
      class="absolute top-2 right-2"
    >
      <div class="flex items-center gap-1.5 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full">
        <UIcon
          name="i-lucide-loader-2"
          class="size-3 animate-spin"
        />
        Loading
      </div>
    </div>
  </div>
</template>
