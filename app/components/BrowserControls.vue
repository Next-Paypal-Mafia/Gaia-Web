<script setup lang="ts">
const props = defineProps<{
  url: string
  isConnected: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  navigate: [url: string]
  back: []
  forward: []
  reload: []
}>()

const urlInput = ref(props.url)

watch(() => props.url, (val) => {
  urlInput.value = val
})

function onNavigate() {
  if (urlInput.value.trim()) {
    emit('navigate', urlInput.value.trim())
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5 px-3 py-2 mx-2 rounded-2xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-lg dark:shadow-xl dark:shadow-black/20">
    <!-- Navigation buttons -->
    <UButton
      icon="i-lucide-arrow-left"
      variant="ghost"
      size="xs"
      :disabled="!isConnected"
      @click="emit('back')"
    />
    <UButton
      icon="i-lucide-arrow-right"
      variant="ghost"
      size="xs"
      :disabled="!isConnected"
      @click="emit('forward')"
    />
    <UButton
      :icon="isLoading ? 'i-lucide-x' : 'i-lucide-rotate-cw'"
      variant="ghost"
      size="xs"
      :disabled="!isConnected"
      @click="emit('reload')"
    />

    <!-- URL bar -->
    <form
      class="flex-1 flex"
      @submit.prevent="onNavigate"
    >
      <UInput
        v-model="urlInput"
        :placeholder="isConnected ? 'Enter URL...' : 'Not connected'"
        :disabled="!isConnected"
        size="sm"
        icon="i-lucide-globe"
        class="flex-1"
        :ui="{ base: 'font-mono text-xs' }"
        @keydown.enter="onNavigate"
      />
    </form>
  </div>
</template>
