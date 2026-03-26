<script setup lang="ts">
import { marked } from 'marked'
interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<Record<string, any>>
}

interface StepGroup {
  msgId: string
  title: string
  items: Array<Record<string, any> & { _partIdx: number }>
  isCompleted: boolean
}

const props = defineProps<{
  messages: UIMessage[]
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  isAgentRunning: boolean
  /** Agent session connected — for subtle empty hints */
  isConnected?: boolean
}>()

const taskFeedbackOpen = defineModel<boolean>('taskFeedbackOpen', { default: false })

const emit = defineEmits<{
  taskFeedbackVote: [sentiment: 'positive' | 'negative']
  taskFeedbackBannerEntered: []
}>()

function onTaskFeedbackVote(sentiment: 'positive' | 'negative') {
  emit('taskFeedbackVote', sentiment)
}

function onTaskFeedbackBannerEntered() {
  emit('taskFeedbackBannerEntered')
}

function isToolPart(part: any): boolean {
  return typeof part.type === 'string' && part.type.startsWith('tool-')
}

function toolName(part: any): string {
  if (part.toolName) return part.toolName
  if (typeof part.type === 'string' && part.type.startsWith('tool-')) return part.type.slice(5)
  return 'unknown'
}

function isToolDone(part: any): boolean {
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
  websearch: { label: 'Searching the web', icon: 'i-lucide-search' },
  Exa_web_search_exa: { label: 'Searching the web', icon: 'i-lucide-search' },
}

function toolLabel(name: string) {
  return TOOL_META[name]?.label ?? name
}

function toolIcon(name: string) {
  return TOOL_META[name]?.icon ?? 'i-lucide-wrench'
}

function toolDetail(name: string, part: any): string {
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

function getPromptForAssistant(msg: UIMessage): string | null {
  const idx = props.messages.findIndex(m => m.id === msg.id)
  if (idx > 0) {
    for (let i = idx - 1; i >= 0; i--) {
      const prevMsg = props.messages[i]
      if (prevMsg?.role === 'user') {
        if (isBetaFeedbackMessage(prevMsg)) continue
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
    for (let i = 0; i < promptLines.length; i++) {
      const pLine = promptLines[i]
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

const feedContainer = ref<HTMLElement>()
const expandedSteps = ref<Set<string>>(new Set())

const stepGroups = computed<StepGroup[]>(() => {
  const groups: StepGroup[] = []
  const assistantMsgs = props.messages.filter(m => m.role === 'assistant')

  for (const [msgIdx, msg] of assistantMsgs.entries()) {
    const items: StepGroup['items'] = []
    for (const [partIdx, part] of msg.parts.entries()) {
      if (isToolPart(part) || (part.type === 'reasoning' && (part as any).text?.trim())) {
        items.push({ ...part, _partIdx: partIdx })
      }
    }
    if (items.length === 0) continue

    const isLast = msgIdx === assistantMsgs.length - 1
    groups.push({
      msgId: msg.id,
      title: deriveTitleFromItems(items),
      items,
      isCompleted: !isLast || !props.isAgentRunning,
    })
  }

  return groups
})

const totalActions = computed(() =>
  stepGroups.value.reduce((sum, g) => sum + g.items.length, 0),
)

function isBetaFeedbackMessage(msg: UIMessage): boolean {
  return msg.role === 'user' && msg.parts.some(p => p.type === 'beta-feedback')
}

const currentPrompt = computed(() => {
  const lastUser = [...props.messages].reverse().find(
    m => m.role === 'user' && !isBetaFeedbackMessage(m),
  )
  if (!lastUser) return null
  const textPart = lastUser.parts.find(p => p.type === 'text')
  return (textPart as any)?.text ?? null
})

function deriveTitleFromItems(items: StepGroup['items']): string {
  const reasoning = items.find(i => i.type === 'reasoning')
  if (reasoning) {
    const text = (reasoning as any).text as string
    const sentence = (text.split(/[.!?\n]/)[0] || '').trim()
    if (sentence.length > 3) return sentence.length > 80 ? sentence.slice(0, 77) + '...' : sentence
  }

  const tools = items.filter(i => isToolPart(i))
  if (tools.length === 0) return 'Thinking'

  const first = tools[0]
  const name = toolName(first)
  const detail = toolDetail(name, first)

  if (name === 'navigate' || name === 'playwright_browser_navigate') {
    try { return `Browsing ${new URL(detail).hostname}` } catch { return 'Navigating' }
  }
  if (name === 'websearch' || name === 'Exa_web_search_exa') return 'Searching the web'

  const labels = [...new Set(tools.map(t => toolLabel(toolName(t))))]
  return labels.slice(0, 3).join(', ')
}

// Auto-expand the latest step while running; expand ALL on completion
watch(() => stepGroups.value.length, (len, prev) => {
  if (len === 0) return
  if (props.isAgentRunning && len > (prev ?? 0)) {
    const latest = stepGroups.value[len - 1]
    if (latest) expandedSteps.value = new Set([latest.msgId])
  }
  scrollToBottom()
}, { immediate: true })

watch(() => props.isAgentRunning, (running, wasRunning) => {
  if (wasRunning && !running) {
    expandedSteps.value = new Set()
  }
})

function toggleStep(id: string) {
  const s = new Set(expandedSteps.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedSteps.value = s
}

function isStepExpanded(id: string): boolean {
  return expandedSteps.value.has(id)
}

function scrollToBottom() {
  nextTick(() => {
    if (feedContainer.value) {
      feedContainer.value.scrollTop = feedContainer.value.scrollHeight
    }
  })
}

watch(() => props.messages, () => scrollToBottom(), { deep: true })





function parseMarkdown(text: string): string {
  if (!text) return ''
  try {
    return marked.parse(text) as string
  } catch (e) {
    return text
  }
}

/** Chat strip (same visibility rules as ChatPanel text stream) */
function hasTextParts(message: UIMessage): boolean {
  return message.parts.some(p => p.type === 'text' && (p as any).text?.trim())
}

function hasVisibleAssistantText(message: UIMessage): boolean {
  const prompt = getPromptForAssistant(message)
  return message.parts.some((p) => {
    if (p.type !== 'text')
      return false
    const cleaned = cleanAssistantText((p as any).text, prompt)
    return !!cleaned?.trim()
  })
}

const latestAssistantHasText = computed(() => {
  const last = [...props.messages].reverse().find(m => m.role === 'assistant')
  return last ? hasVisibleAssistantText(last) : false
})

const showWorkingIndicator = computed(() => {
  return props.isAgentRunning && !latestAssistantHasText.value
})

/** One timeline: user prompts + assistant (tools/thinking + replies) in order */
interface UnifiedSegment {
  key: string
  kind: 'user' | 'assistant'
  message: UIMessage
  /** Tool/reasoning group for this assistant message, if any */
  group: StepGroup | null
}

const groupsByAssistantId = computed(() => {
  const m = new Map<string, StepGroup>()
  for (const g of stepGroups.value)
    m.set(g.msgId, g)
  return m
})

function isLastAssistantMessage(msg: UIMessage): boolean {
  const assistants = props.messages.filter(m => m.role === 'assistant')
  const last = assistants[assistants.length - 1]
  return !!last && last?.id === msg.id
}

function textPartsForMessage(msg: UIMessage) {
  const prompt = getPromptForAssistant(msg)
  return msg.parts.filter((p) => {
    if (p.type !== 'text')
      return false
    const cleaned = cleanAssistantText((p as any).text, prompt)
    return !!cleaned?.trim()
  })
}

const unifiedSegments = computed<UnifiedSegment[]>(() => {
  const out: UnifiedSegment[] = []
  const groupMap = groupsByAssistantId.value

  for (const msg of props.messages) {
    if (msg.role === 'user') {
      if (hasTextParts(msg)) {
        out.push({ key: `u-${msg.id}`, kind: 'user', message: msg, group: null })
      }
      else if (isBetaFeedbackMessage(msg)) {
        out.push({ key: `u-${msg.id}`, kind: 'user', message: msg, group: null })
      }
      continue
    }

    const group = groupMap.get(msg.id) ?? null
    const visibleText = hasVisibleAssistantText(msg)
    const lastAsst = isLastAssistantMessage(msg)
    const awaitingAssistantContent =
      lastAsst
      && !group
      && !visibleText
      && (
        props.isAgentRunning
        || props.status === 'submitted'
        || props.status === 'streaming'
      )

    if (group || visibleText || awaitingAssistantContent) {
      out.push({ key: `a-${msg.id}`, kind: 'assistant', message: msg, group })
    }
  }
  return out
})

const showInitialThinking = computed(
  () =>
    (props.status === 'submitted' || props.status === 'streaming')
    && !stepGroups.value.length
    && !unifiedSegments.value.some(s => s.kind === 'assistant'),
)

const feedEmpty = computed(
  () =>
    unifiedSegments.value.length === 0
    && !showInitialThinking.value
    && !props.isAgentRunning,
)
</script>

<template>
  <div
    class="glass-jelly flex flex-col h-full rounded-2xl overflow-hidden ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15"
  >
    <!-- Header -->
    <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-black/6 dark:border-white/6 shrink-0">
      <div class="relative">
        <UIcon name="i-lucide-sparkles" class="size-4" :class="isAgentRunning ? 'text-primary' : 'text-muted/50'" />
        <span v-if="isAgentRunning" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-semibold uppercase tracking-wider" :class="isAgentRunning ? 'text-default' : 'text-muted'">
          {{ isAgentRunning ? 'Working' : stepGroups.length ? 'Completed' : 'Activity' }}
        </span>
        <span class="text-[10px] text-dimmed truncate">Thinking &amp; chat in one thread</span>
      </div>
      <span v-if="stepGroups.length" class="text-[10px] text-dimmed ml-auto shrink-0 text-right leading-tight">
        {{ stepGroups.length }} {{ stepGroups.length === 1 ? 'step' : 'steps' }}
        <span class="text-dimmed/70"> · </span>
        {{ totalActions }} {{ totalActions === 1 ? 'action' : 'actions' }}
      </span>
    </div>

    <!-- Current task -->
    <div v-if="currentPrompt && isAgentRunning" class="px-4 py-2 border-b border-black/6 dark:border-white/6 shrink-0 bg-primary/5">
      <p class="text-xs text-dimmed truncate">
        <span class="text-muted font-medium">Task:</span> {{ currentPrompt }}
      </p>
    </div>

    <!-- Merged glass feed: user messages, assistant tools/thinking, assistant replies (single scroll) -->
    <div ref="feedContainer" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 unified-feed-scroll">
      <TransitionGroup name="unified" tag="div" class="space-y-4">
        <div v-for="seg in unifiedSegments" :key="seg.key">
          <!-- User prompt -->
          <div v-if="seg.kind === 'user'" class="flex justify-end">
            <div
              class="max-w-[92%] rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm"
              :class="isBetaFeedbackMessage(seg.message)
                ? 'bg-primary/15 text-default ring-1 ring-primary/25 dark:bg-primary/10'
                : 'bg-primary text-white'"
            >
              <template v-for="(part, i) in seg.message.parts" :key="i">
                <p v-if="part.type === 'text'" class="text-sm whitespace-pre-wrap leading-relaxed">
                  {{ (part as any).text }}
                </p>
                <div
                  v-else-if="part.type === 'beta-feedback'"
                  class="flex items-center gap-2 text-sm leading-relaxed"
                >
                  <UIcon
                    :name="(part as any).sentiment === 'positive' ? 'i-lucide-thumbs-up' : 'i-lucide-thumbs-down'"
                    class="size-4 shrink-0 text-primary"
                  />
                  <span>{{ (part as any).displayText }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Assistant: thinking/tools + reply in one block -->
          <div v-else class="flex justify-start">
            <div class="max-w-full w-full space-y-2.5">
              <!-- Tool / reasoning step (same expandable UI as before) -->
              <div
                v-if="seg.group"
                class="rounded-xl overflow-hidden bg-black/2 dark:bg-white/3 ring-1 ring-black/6 dark:ring-white/6"
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-colors text-left"
                  :class="isStepExpanded(seg.group.msgId) ? 'bg-black/2 dark:bg-white/3' : 'hover:bg-black/2 dark:hover:bg-white/2'"
                  @click="toggleStep(seg.group.msgId)"
                >
                  <div class="shrink-0">
                    <span v-if="seg.group.isCompleted" class="size-5 rounded-full bg-success/15 flex items-center justify-center">
                      <UIcon name="i-lucide-check" class="size-3 text-success" />
                    </span>
                    <span v-else class="size-5 rounded-full bg-primary/15 flex items-center justify-center">
                      <span class="size-2 rounded-full bg-primary animate-pulse" />
                    </span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-default truncate block">{{ seg.group.title }}</span>
                    <span class="text-[10px] text-dimmed">{{ seg.group.items.length }} {{ seg.group.items.length === 1 ? 'action' : 'actions' }}</span>
                  </div>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="size-3.5 text-muted/60 shrink-0 transition-transform duration-200"
                    :class="isStepExpanded(seg.group.msgId) ? '' : '-rotate-90'"
                  />
                </button>
                <div
                  class="step-content"
                  :class="isStepExpanded(seg.group.msgId) ? 'step-content--open' : 'step-content--closed'"
                >
                  <div class="pl-5 border-l-2 border-primary/20 ml-5 space-y-px pb-2 pt-1">
                    <TransitionGroup name="activity" tag="div">
                      <div
                        v-for="item in seg.group.items"
                        :key="`${seg.group.msgId}-${item._partIdx}`"
                      >
                        <div
                          v-if="isToolPart(item)"
                          class="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-colors duration-200"
                          :class="!isToolDone(item) && !isToolError(item) ? 'bg-primary/5' : ''"
                        >
                          <UIcon v-if="isToolDone(item)" name="i-lucide-check-circle-2" class="size-3.5 text-success shrink-0" />
                          <UIcon v-else-if="isToolError(item)" name="i-lucide-x-circle" class="size-3.5 text-error shrink-0" />
                          <UIcon v-else name="i-lucide-loader-2" class="size-3.5 text-primary animate-spin shrink-0" />
                          <UIcon :name="toolIcon(toolName(item))" class="size-3 text-muted shrink-0" />
                          <span class="text-default font-medium whitespace-nowrap">{{ toolLabel(toolName(item)) }}</span>
                          <span v-if="toolDetail(toolName(item), item)" class="text-dimmed truncate min-w-0">
                            {{ toolDetail(toolName(item), item) }}
                          </span>
                        </div>
                        <div
                          v-else-if="item.type === 'reasoning'"
                          class="text-[11px] text-dimmed italic py-1 px-2"
                        >
                          {{ (item as any).text }}
                        </div>
                      </div>
                    </TransitionGroup>
                  </div>
                </div>
              </div>

              <!-- Assistant text reply -->
              <div
                v-for="(part, pi) in textPartsForMessage(seg.message)"
                :key="`${seg.message.id}-t-${pi}`"
                class="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-black/2 dark:bg-white/4 ring-1 ring-black/6 dark:ring-white/8 text-sm leading-relaxed text-default shadow-sm markdown-body"
                v-html="parseMarkdown(cleanAssistantText((part as any).text, getPromptForAssistant(seg.message)))"
              />

              <!-- In-progress: no tools yet, no text -->
              <div
                v-if="(isAgentRunning || status === 'submitted' || status === 'streaming') && isLastAssistantMessage(seg.message) && !seg.group && !hasVisibleAssistantText(seg.message)"
                class="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-black/2 dark:bg-white/3 text-dimmed text-sm"
              >
                <UIcon name="i-lucide-loader-2" class="size-4 text-primary animate-spin shrink-0" />
                <span>Thinking&hellip;</span>
              </div>

              <!-- Typing while tools done / running but no final text yet -->
              <div
                v-if="showWorkingIndicator && isLastAssistantMessage(seg.message) && seg.group && !hasVisibleAssistantText(seg.message)"
                class="flex items-center gap-2 py-2 px-3 text-xs text-dimmed"
              >
                <span class="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span>Writing reply&hellip;</span>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Thinking before first assistant chunk arrives -->
      <Transition name="activity">
        <div
          v-if="showInitialThinking"
          class="flex items-center gap-2.5 py-2 px-3 rounded-xl bg-black/2 dark:bg-white/3"
        >
          <UIcon name="i-lucide-loader-2" class="size-4 text-primary animate-spin" />
          <span class="text-sm text-dimmed">Thinking&hellip;</span>
        </div>
      </Transition>

      <!-- Idle empty -->
      <div
        v-if="feedEmpty"
         class="flex flex-col items-center justify-center min-h-45 text-muted gap-3 py-8"
       >
         <UIcon name="i-lucide-messages-square" class="size-10 text-muted/25" />
         <p class="text-xs text-dimmed text-center max-w-55">
          <template v-if="props.isConnected === false">
            Connect the agent to run tasks. Conversation and steps will show here together.
          </template>
          <template v-else>
            Send a message — replies and browser steps appear in this thread.
          </template>
        </p>
      </div>

      <div v-if="taskFeedbackOpen" class="mt-4 shrink-0 px-0.5">
        <TaskFeedbackModal
          v-model:open="taskFeedbackOpen"
          @vote="onTaskFeedbackVote"
          @banner-entered="onTaskFeedbackBannerEntered"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.unified-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.unified-leave-active {
  transition: all 0.2s ease-in;
}
.unified-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.unified-leave-to {
  opacity: 0;
}
.unified-move {
  transition: transform 0.3s ease;
}

.unified-feed-scroll {
  scrollbar-width: thin;
}

.step-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-leave-active {
  transition: all 0.2s ease-in;
}
.step-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.step-leave-to {
  opacity: 0;
}
.step-move {
  transition: transform 0.3s ease;
}

.activity-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.activity-leave-active {
  transition: all 0.15s ease-in;
}
.activity-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.activity-leave-to {
  opacity: 0;
}
.activity-move {
  transition: transform 0.25s ease;
}

.step-content {
  display: grid;
  transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}
.step-content > div {
  overflow: hidden;
}
.step-content--open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.step-content--closed {
  grid-template-rows: 0fr;
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
