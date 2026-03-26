<script setup lang="ts">
const props = defineProps<{
  isAgentRunning: boolean
  isConnected: boolean
  inputLocked?: boolean
  /** Survey is required (timer fired) — used with surveyBannerVisible for when to lock UI */
  surveyPending?: boolean
  /** Survey card has finished entering — until then do not lock input or imply it is visible */
  surveyBannerVisible?: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const input = ref("")

const surveyLocksInput = computed(
  () => !!props.surveyPending && !!props.surveyBannerVisible,
)

const inputPlaceholder = computed(() => {
  if (props.surveyPending && !props.surveyBannerVisible) return "Preparing quick feedback…"
  if (surveyLocksInput.value) return "Answer the quick feedback above to continue chatting..."
  if (props.inputLocked) return "Agent is busy in another chat..."
  if (props.isAgentRunning) return "Wait for the reply or stop the agent to send another message..."
  if (props.isConnected) return "Ask jellybyte to do something..."
  return "Connect to Chrome first"
})

function onSubmit() {
  if (surveyLocksInput.value || props.isAgentRunning || props.inputLocked) return
  const text = input.value.trim()
  if (!text) return
  emit("send", text)
  input.value = ""
}

function onEnter(e: KeyboardEvent) {
  if (surveyLocksInput.value || props.isAgentRunning || props.inputLocked) {
    e.preventDefault()
    return
  }
  onSubmit()
}
</script>

<template>
  <div class="px-5 py-3 bg-white/60 dark:bg-white/4 backdrop-blur-2xl rounded-full shadow-lg dark:shadow-xl dark:shadow-black/20 border border-black/6 dark:border-white/8">
    <form class="flex items-center gap-3" @submit.prevent="onSubmit">
      <input
        v-model="input"
        type="text"
        :placeholder="inputPlaceholder"
        :disabled="!isConnected || surveyLocksInput || inputLocked || isAgentRunning"
        class="flex-1 bg-transparent text-sm text-default placeholder-dimmed outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        @keydown.enter.exact.prevent="onEnter"
      >
      <div class="shrink-0">
        <button
          v-if="!isAgentRunning"
          type="submit"
          :disabled="!input.trim() || !isConnected || surveyLocksInput || inputLocked"
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
