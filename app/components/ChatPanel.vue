<script setup lang="ts">
import { marked } from 'marked'
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

function getPromptForAssistant(msg: UIMessage): string | null {
  const idx = props.messages.findIndex(m => m.id === msg.id)
  if (idx > 0) {
    for (let i = idx - 1; i >= 0; i--) {
      const prevMsg = props.messages[i]
      if (prevMsg?.role === 'user') {
        const textPart = prevMsg?.parts?.find(p => p.type === 'text')
        return (textPart as any)?.text ?? null
      }
    }
  }
  return null
}

function cleanAssistantText(text: string | undefined, prompt: string | null): string {
  if (!text || typeof text !== 'string') return ''
  if (!prompt) return text
  
  const lines = text.split('\n')
  let firstIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line && line.trim()) {
      firstIdx = i
      break
    }
  }
  
  if (firstIdx !== -1) {
    const targetLine = lines[firstIdx]
    if (!targetLine) return text
    
    const firstLinePure = targetLine.replace(/^[\s#*>-]+/, '').trim().toLowerCase()
    
    const promptLines = prompt.split('\n')
    let firstPromptLine = ''
    for (const pLine of promptLines) {
      if (pLine && pLine.trim()) {
        firstPromptLine = pLine.replace(/^[\s#*>-]+/, '').trim().toLowerCase()
        break
      }
    }
    
    if (firstLinePure.length > 5 && firstPromptLine.length > 5) {
      if (
        firstLinePure === firstPromptLine || 
        firstLinePure.startsWith(firstPromptLine) || 
        firstPromptLine.startsWith(firstLinePure) ||
        firstLinePure.includes(firstPromptLine)
      ) {
        lines.splice(0, firstIdx + 1)
        return lines.join('\n').trimStart()
      }
    }
  }
  
  return text
}

function parseMarkdown(text: string): string {
  if (!text) return ''
  try {
    return marked.parse(text) as string
  } catch (e) {
    return text
  }
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
  <div class="glass-jelly flex flex-col h-full rounded-2xl overflow-hidden ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15">
    <!-- Header -->
    <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
      <UIcon name="i-lucide-messages-square" class="size-4 text-muted" />
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">Chat</span>
    </div>

    <!-- Messages (text only — tool calls live in AgentActivity) -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <template v-for="message in messages" :key="message?.id">
        <!-- User message -->
        <div v-if="message?.role === 'user'" class="flex justify-end">
          <div class="bg-primary text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[80%] text-sm">
            <template v-for="(part, i) in message?.parts" :key="i">
              <p v-if="part?.type === 'text'" class="whitespace-pre-wrap">{{ (part as any).text }}</p>
            </template>
          </div>
        </div>

        <!-- Assistant text responses only -->
        <div v-else-if="message?.role === 'assistant' && hasTextParts(message)" class="space-y-1.5">
          <template v-for="(part, i) in message?.parts" :key="`${message?.id}-${i}`">
            <div
              v-if="part?.type === 'text' && (part as any).text?.trim()"
              class="bg-black/[0.02] dark:bg-white/[0.04] ring-1 ring-black/[0.06] dark:ring-white/[0.08] rounded-2xl rounded-bl-md px-3.5 py-2.5 max-w-[85%] text-sm leading-relaxed markdown-body shadow-sm"
              v-html="parseMarkdown(cleanAssistantText((part as any).text, getPromptForAssistant(message)))"
            />
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
          <span class="text-xs text-dimmed">jellybyte is working&hellip;</span>
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

.markdown-body :deep(p) { margin-bottom: 0.75em; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }
.markdown-body :deep(a) { color: var(--ui-color-primary-500); text-decoration: underline; text-underline-offset: 2px; }
.markdown-body :deep(strong) { font-weight: 600; color: inherit; }
.markdown-body :deep(ul) { list-style-type: disc; padding-left: 1.25em; margin-bottom: 0.75em; margin-top: 0.5em; }
.markdown-body :deep(ol) { list-style-type: decimal; padding-left: 1.25em; margin-bottom: 0.75em; margin-top: 0.5em; }
.markdown-body :deep(li) { margin-bottom: 0.25em; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5em; color: inherit; }
.markdown-body :deep(h1) { font-size: 1.3em; }
.markdown-body :deep(h2) { font-size: 1.15em; }
.markdown-body :deep(h3) { font-size: 1.05em; }
.markdown-body :deep(code) { font-family: monospace; font-size: 0.9em; background-color: rgba(128, 128, 128, 0.15); padding: 0.15em 0.3em; border-radius: 0.25em; }
.markdown-body :deep(pre) { background-color: rgba(0, 0, 0, 0.15); padding: 1em; border-radius: 0.5em; overflow-x: auto; margin-bottom: 0.75em; margin-top: 0.5em; border: 1px solid rgba(128, 128, 128, 0.15); }
.markdown-body :deep(pre code) { background-color: transparent; padding: 0; }
.markdown-body :deep(blockquote) { border-left: 3px solid rgba(128, 128, 128, 0.3); padding-left: 1em; color: inherit; opacity: 0.8; margin-bottom: 0.75em; margin-top: 0.5em; }
.markdown-body :deep(table) { width: 100%; border-collapse: collapse; margin-bottom: 0.75em; margin-top: 0.5em; font-size: 0.9em; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid rgba(128, 128, 128, 0.2); padding: 0.5em 0.75em; text-align: left; }
.markdown-body :deep(th) { background-color: rgba(128, 128, 128, 0.1); font-weight: 600; }

</style>
