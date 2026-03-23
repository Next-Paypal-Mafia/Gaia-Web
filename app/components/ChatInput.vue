<script setup lang="ts">
defineProps<{
  isAgentRunning: boolean
  isConnected: boolean
  inputLocked?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const input = ref('')

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}
</script>

<template>
  <div class="px-5 py-3 bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl rounded-full shadow-lg dark:shadow-xl dark:shadow-black/20 border border-black/[0.06] dark:border-white/[0.08]">
    <form class="flex items-center gap-3" @submit.prevent="onSubmit">
      <input
        v-model="input"
        type="text"
        :placeholder="inputLocked ? 'Agent is busy in another chat...' : isConnected ? 'Ask jellybyte to do something...' : 'Connect to Chrome first'"
        :disabled="!isConnected || inputLocked"
        class="flex-1 bg-transparent text-sm text-default placeholder-dimmed outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        @keydown.enter.exact.prevent="onSubmit"
      >
      <div class="shrink-0">
        <button
          v-if="!isAgentRunning"
          type="submit"
          :disabled="!input.trim() || !isConnected || inputLocked"
          class="size-9 rounded-full bg-primary text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 active:scale-95"
        >
          <UIcon name="i-lucide-arrow-up" class="size-4" />
        </button>
        <button
          v-else
          type="button"
          class="size-9 rounded-full bg-error text-white flex items-center justify-center transition-all hover:bg-error/90 active:scale-95"
          @click="emit('stop')"
        >
          <UIcon name="i-lucide-square" class="size-3.5" />
        </button>
      </div>
    </form>
  </div>
</template>
