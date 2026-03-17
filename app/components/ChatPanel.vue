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

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const input = ref('')
const messagesContainer = ref<HTMLElement>()

function onSubmit() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(
  () => props.messages,
  () => scrollToBottom(),
  { deep: true },
)
watch(
  () => props.status,
  () => scrollToBottom(),
)

function isToolPart(part: any): boolean {
  return typeof part.type === 'string' && part.type.startsWith('tool-')
}

function toolName(part: any): string {
  if (part.toolName) return part.toolName
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return part.type.slice(5)
  }
  return 'unknown'
}

function isToolDone(part: any): boolean {
  // SDK ToolState.status is 'completed'; guard legacy string shape too
  return part.state?.status === 'completed' || part.state === 'output-available'
}

function isToolError(part: any): boolean {
  return part.state?.status === 'error' || part.state === 'output-error' || part.state === 'output-denied'
}

const TOOL_META: Record<string, { label: string; icon: string }> = {
  navigate: { label: 'Navigating', icon: 'i-lucide-compass' },
  clickElement: { label: 'Clicking element', icon: 'i-lucide-mouse-pointer-click' },
  clickCoordinates: { label: 'Clicking', icon: 'i-lucide-mouse-pointer-click' },
  typeText: { label: 'Typing', icon: 'i-lucide-keyboard' },
  pressKey: { label: 'Pressing key', icon: 'i-lucide-keyboard' },
  scroll: { label: 'Scrolling', icon: 'i-lucide-arrow-down-up' },
  getPageState: { label: 'Reading page', icon: 'i-lucide-scan-eye' },
  waitForLoad: { label: 'Waiting for load', icon: 'i-lucide-timer' },
  playwright_browser_navigate: { label: 'Navigating', icon: 'i-lucide-compass' },
  playwright_browser_click: { label: 'Clicking', icon: 'i-lucide-mouse-pointer-click' },
  playwright_browser_type: { label: 'Typing', icon: 'i-lucide-keyboard' },
  playwright_browser_snapshot: { label: 'Reading page', icon: 'i-lucide-scan-eye' },
}

function toolLabel(name: string) {
  return TOOL_META[name]?.label ?? name
}

function toolIcon(name: string) {
  return TOOL_META[name]?.icon ?? 'i-lucide-wrench'
}

function toolDetail(name: string, part: any): string {
  // SDK shape: state.input holds the input object
  const input = part?.state?.input ?? part?.input
  if (!input) return ''
  if (name === 'navigate' || name === 'playwright_browser_navigate') return input.url ?? ''
  if (name === 'clickElement') return input.description ?? ''
  if (name === 'typeText' || name === 'playwright_browser_type') return `"${input.text ?? input.selector}"`
  if (name === 'pressKey' || name === 'playwright_browser_press_key') return input.key ?? ''
  if (name === 'scroll') return input.direction ?? ''
  if (name === 'clickCoordinates' || name === 'playwright_browser_click') return input.selector ?? `(${input.x}, ${input.y})`
  return ''
}
</script>

<template>
  <div class="flex flex-col h-full rounded-2xl bg-elevated mx-2 overflow-hidden">
    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      <template v-for="message in messages" :key="message.id">
        <!-- User message -->
        <div v-if="message.role === 'user'" class="flex justify-end">
          <div class="bg-primary text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[85%] text-sm">
            <template v-for="(part, i) in message.parts" :key="i">
              <p v-if="part.type === 'text'" class="whitespace-pre-wrap">{{ (part as any).text }}</p>
            </template>
          </div>
        </div>

        <!-- Assistant message -->
        <div v-else-if="message.role === 'assistant'" class="space-y-1.5">
          <template v-for="(part, i) in message.parts" :key="`${message.id}-${i}`">
            <!-- Text response (streaming or final) -->
            <div
              v-if="part.type === 'text' && (part as any).text?.trim()"
              class="bg-default/80 ring-1 ring-default rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[85%] text-sm leading-relaxed"
            >
              <p class="whitespace-pre-wrap">{{ (part as any).text }}</p>
            </div>

            <!-- Reasoning / thinking (compact) -->
            <div
              v-else-if="part.type === 'reasoning' && (part as any).text?.trim()"
              class="text-xs text-dimmed italic pl-1 max-w-[85%] line-clamp-2"
            >
              {{ (part as any).text }}
            </div>

            <!-- Tool call (type: tool-{name}) -->
            <div
              v-else-if="isToolPart(part)"
              class="flex items-start gap-2 text-xs pl-1 py-0.5"
            >
              <div class="mt-0.5 shrink-0">
                <UIcon
                  v-if="isToolDone(part)"
                  name="i-lucide-check-circle-2"
                  class="size-3.5 text-success"
                />
                <UIcon
                  v-else-if="isToolError(part)"
                  name="i-lucide-x-circle"
                  class="size-3.5 text-error"
                />
                <UIcon
                  v-else
                  name="i-lucide-loader-2"
                  class="size-3.5 text-warning animate-spin"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <UIcon :name="toolIcon(toolName(part))" class="size-3 text-muted shrink-0" />
                  <span class="font-medium text-default">{{ toolLabel(toolName(part)) }}</span>
                </div>
                <p
                  v-if="toolDetail(toolName(part), part)"
                  class="text-dimmed truncate mt-0.5"
                >
                  {{ toolDetail(toolName(part), part) }}
                </p>
              </div>
            </div>

            <!-- Step boundary (subtle separator) -->
            <div v-else-if="part.type === 'step-start' && i > 0" class="border-t border-default/40 my-1" />
          </template>
        </div>
      </template>

      <!-- Thinking indicator when waiting for first response -->
      <div
        v-if="(status === 'submitted' || status === 'streaming') && !messages.some(m => m.role === 'assistant')"
        class="flex items-center gap-2.5 text-xs text-muted pl-1 py-1"
      >
        <div class="size-5 rounded-md bg-primary/10 flex items-center justify-center">
          <UIcon name="i-lucide-loader-2" class="size-3 text-primary animate-spin" />
        </div>
        <span class="text-dimmed">Gaia is thinking&hellip;</span>
      </div>

      <!-- Empty state -->
      <div
        v-if="!messages.length && status === 'ready'"
        class="flex flex-col items-center justify-center h-full text-muted gap-4"
      >
        <div class="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <UIcon name="i-lucide-earth" class="size-6 text-primary" />
        </div>
        <div class="text-center space-y-1">
          <p class="text-sm font-medium text-default">What can I browse for you?</p>
          <p class="text-xs text-dimmed">Describe a task and Gaia will handle the rest.</p>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="p-3 pt-0">
      <form class="flex gap-2" @submit.prevent="onSubmit">
        <UTextarea
          v-model="input"
          :placeholder="isConnected ? 'Ask Gaia to do something...' : 'Connect to Chrome first'"
          :disabled="!isConnected"
          autoresize
          :rows="1"
          :maxrows="4"
          class="flex-1"
          size="sm"
          @keydown.enter.exact.prevent="onSubmit"
        />
        <div class="flex flex-col justify-end">
          <UButton
            v-if="!isAgentRunning"
            type="submit"
            icon="i-lucide-send"
            size="sm"
            :disabled="!input.trim() || !isConnected"
          />
          <UButton
            v-else
            icon="i-lucide-square"
            size="sm"
            color="error"
            @click="emit('stop')"
          />
        </div>
      </form>
    </div>
  </div>
</template>
