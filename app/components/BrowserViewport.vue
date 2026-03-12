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
      class="flex flex-col items-center gap-3 text-muted"
    >
      <UIcon
        name="i-lucide-monitor"
        class="size-12"
      />
      <p class="text-sm">
        Waiting for browser content...
      </p>
    </div>

    <!-- Not connected -->
    <div
      v-else
      class="flex flex-col items-center gap-4 text-muted max-w-sm text-center px-6"
    >
      <UIcon
        name="i-lucide-monitor-off"
        class="size-12"
      />
      <div>
        <p class="text-sm font-medium text-default mb-1">
          Browser not connected
        </p>
        <p class="text-xs">
          Start Chrome with debugging enabled, then click Connect.
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
