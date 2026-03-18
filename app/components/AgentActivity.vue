<script setup lang="ts">
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
}>()

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

const currentPrompt = computed(() => {
  const lastUser = [...props.messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return null
  const textPart = lastUser.parts.find(p => p.type === 'text')
  return (textPart as any)?.text ?? null
})

function deriveTitleFromItems(items: StepGroup['items']): string {
  const reasoning = items.find(i => i.type === 'reasoning')
  if (reasoning) {
    const text = (reasoning as any).text as string
    const sentence = text.split(/[.!?\n]/)[0].trim()
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
</script>

<template>
  <div class="flex flex-col h-full rounded-2xl bg-elevated overflow-hidden">
    <!-- Header -->
    <div class="flex items-center gap-2.5 px-4 py-2.5 border-b border-default/20 shrink-0">
      <div class="relative">
        <UIcon name="i-lucide-sparkles" class="size-4" :class="isAgentRunning ? 'text-primary' : 'text-muted/50'" />
        <span v-if="isAgentRunning" class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <span class="text-xs font-semibold uppercase tracking-wider" :class="isAgentRunning ? 'text-default' : 'text-muted'">
        {{ isAgentRunning ? 'Working' : stepGroups.length ? 'Completed' : 'Agent' }}
      </span>
      <span v-if="stepGroups.length" class="text-[10px] text-dimmed ml-auto">
        {{ stepGroups.length }} {{ stepGroups.length === 1 ? 'step' : 'steps' }} · {{ totalActions }} {{ totalActions === 1 ? 'action' : 'actions' }}
      </span>
    </div>

    <!-- Current task -->
    <div v-if="currentPrompt && isAgentRunning" class="px-4 py-2 border-b border-default/10 shrink-0 bg-primary/5">
      <p class="text-xs text-dimmed truncate">
        <span class="text-muted font-medium">Task:</span> {{ currentPrompt }}
      </p>
    </div>

    <!-- Step-by-step feed -->
    <div ref="feedContainer" class="flex-1 overflow-y-auto px-2 py-2">
      <TransitionGroup v-if="stepGroups.length" name="step" tag="div" class="space-y-0.5">
        <div v-for="(group, gi) in stepGroups" :key="group.msgId" class="rounded-xl overflow-hidden">
          <!-- Step header -->
          <button
            class="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-colors text-left"
            :class="isStepExpanded(group.msgId) ? 'bg-default/40' : 'hover:bg-default/30'"
            @click="toggleStep(group.msgId)"
          >
            <div class="shrink-0">
              <span v-if="group.isCompleted" class="size-5 rounded-full bg-success/15 flex items-center justify-center">
                <UIcon name="i-lucide-check" class="size-3 text-success" />
              </span>
              <span v-else class="size-5 rounded-full bg-primary/15 flex items-center justify-center">
                <span class="size-2 rounded-full bg-primary animate-pulse" />
              </span>
            </div>

            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-default truncate block">{{ group.title }}</span>
              <span class="text-[10px] text-dimmed">{{ group.items.length }} {{ group.items.length === 1 ? 'action' : 'actions' }}</span>
            </div>

            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted/60 shrink-0 transition-transform duration-200"
              :class="isStepExpanded(group.msgId) ? '' : '-rotate-90'"
            />
          </button>

          <!-- Step content (expandable via CSS grid) -->
          <div
            class="step-content"
            :class="isStepExpanded(group.msgId) ? 'step-content--open' : 'step-content--closed'"
          >
            <div class="pl-5 border-l-2 border-default/30 ml-5 space-y-px pb-2 pt-1">
              <TransitionGroup name="activity" tag="div">
                <div
                  v-for="item in group.items"
                  :key="`${group.msgId}-${item._partIdx}`"
                >
                  <!-- Tool call -->
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

                  <!-- Reasoning -->
                  <div
                    v-else-if="item.type === 'reasoning'"
                    class="text-[11px] text-dimmed italic py-1 px-2 line-clamp-2"
                  >
                    {{ (item as any).text }}
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Initial thinking indicator -->
      <Transition name="activity">
        <div
          v-if="(status === 'submitted' || status === 'streaming') && !stepGroups.length"
          class="flex items-center gap-2.5 py-3 px-3"
        >
          <UIcon name="i-lucide-loader-2" class="size-4 text-primary animate-spin" />
          <span class="text-sm text-dimmed">Thinking&hellip;</span>
        </div>
      </Transition>

      <!-- Idle state -->
      <div
        v-if="!isAgentRunning && !stepGroups.length"
        class="flex flex-col items-center justify-center h-full text-muted gap-3"
      >
        <UIcon name="i-lucide-sparkles" class="size-8 text-muted/20" />
        <p class="text-xs text-dimmed">Agent activity will appear here</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
