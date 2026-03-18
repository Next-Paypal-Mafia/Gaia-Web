<script setup lang="ts">
interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<Record<string, any>>
}

const props = defineProps<{
  messages: UIMessage[]
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  isAgentRunning: boolean
  isConnected: boolean
}>()

const messagesContainer = ref<HTMLElement>()

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => props.messages, () => scrollToBottom(), { deep: true })
watch(() => props.status, () => scrollToBottom())
watch(() => props.isAgentRunning, () => scrollToBottom())

function hasTextParts(message: UIMessage): boolean {
  return message.parts.some(p => p.type === 'text' && (p as any).text?.trim())
}

const latestAssistantHasText = computed(() => {
  const last = [...props.messages].reverse().find(m => m.role === 'assistant')
  return last ? hasTextParts(last) : false
})

const showWorkingIndicator = computed(() => {
  return props.isAgentRunning && !latestAssistantHasText.value
})
</script>

<template>
  <div class="flex flex-col h-full rounded-2xl bg-elevated overflow-hidden">
    <!-- Header -->
    <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-default/20 shrink-0">
      <UIcon name="i-lucide-messages-square" class="size-4 text-muted" />
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Chat</span>
    </div>

    <!-- Messages (text only — tool calls live in AgentActivity) -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <template v-for="message in messages" :key="message.id">
        <!-- User message -->
        <div v-if="message.role === 'user'" class="flex justify-end">
          <div class="bg-primary text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[80%] text-sm">
            <template v-for="(part, i) in message.parts" :key="i">
              <p v-if="part.type === 'text'" class="whitespace-pre-wrap">{{ (part as any).text }}</p>
            </template>
          </div>
        </div>

        <!-- Assistant text responses only -->
        <div v-else-if="message.role === 'assistant' && hasTextParts(message)" class="space-y-1.5">
          <template v-for="(part, i) in message.parts" :key="`${message.id}-${i}`">
            <div
              v-if="part.type === 'text' && (part as any).text?.trim()"
              class="bg-default/80 ring-1 ring-default rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[80%] text-sm leading-relaxed"
            >
              <p class="whitespace-pre-wrap">{{ (part as any).text }}</p>
            </div>
          </template>
        </div>
      </template>

      <!-- Working indicator — shown while agent is running but no text response yet -->
      <Transition name="fade">
        <div v-if="showWorkingIndicator" class="flex items-center gap-3 py-2 pl-1">
          <div class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span class="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span class="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
          <span class="text-xs text-dimmed">Gaia is working&hellip;</span>
        </div>
      </Transition>

      <!-- Empty state -->
      <div
        v-if="!messages.length && status === 'ready' && !isAgentRunning"
        class="flex flex-col items-center justify-center h-full text-muted gap-3"
      >
        <UIcon name="i-lucide-messages-square" class="size-8 text-muted/20" />
        <p class="text-xs text-dimmed">Conversation will appear here</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.3s ease;
}
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
