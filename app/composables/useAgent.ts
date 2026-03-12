import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { UIMessage } from 'ai'

type ToolExecutor = (toolName: string, args: any) => Promise<any>

export function useAgent(executeTool: ToolExecutor) {
  const messages = shallowRef<UIMessage[]>([])
  const isAgentRunning = ref(false)
  const status = ref<'ready' | 'submitted' | 'streaming' | 'error'>('ready')
  let syncInterval: ReturnType<typeof setInterval> | null = null
  let activeToolCalls = 0
  let streamDone = false
  let finishCheckTimer: ReturnType<typeof setTimeout> | null = null

  const settings = useSettings()

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: '/api/agent',
      headers: () => {
        const headers: Record<string, string> = {}
        const selectedModel = settings.selectedModel.value
        headers['x-selected-model'] = selectedModel

        const [provider] = selectedModel.includes(':') ? selectedModel.split(':', 2) : ['gemini', selectedModel]
        if (provider === 'openrouter') {
          const key = settings.openRouterApiKey.value
          if (key) headers['x-openrouter-api-key'] = key
        } else {
          const key = settings.geminiApiKey.value
          if (key) headers['x-gemini-api-key'] = key
        }
        return headers
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      activeToolCalls++
      try {
        const result = await executeTool(toolCall.toolName, toolCall.input)
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result,
        })
      } catch (err: any) {
        chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: err?.message || 'Tool execution failed',
        })
      }
      activeToolCalls--
      checkFinish()
    },
    onError(error) {
      console.error('[Agent] Error:', error)
      isAgentRunning.value = false
      status.value = 'error'
      activeToolCalls = 0
      streamDone = false
      syncMessages()
      stopSync()
    },
    onFinish() {
      streamDone = true
      syncMessages()
      checkFinish()
    },
  })

  function checkFinish() {
    if (!streamDone || activeToolCalls > 0) return

    if (finishCheckTimer) clearTimeout(finishCheckTimer)
    finishCheckTimer = setTimeout(() => {
      if (chat.status === 'ready') {
        isAgentRunning.value = false
        status.value = 'ready'
        syncMessages()
        stopSync()
      } else {
        streamDone = false
      }
    }, 200)
  }

  function syncMessages() {
    const current = chat.messages
    const chatStatus = chat.status
    messages.value = current.map(m => ({
      ...m,
      parts: m.parts.map((p: any) => ({ ...p })),
    }))
    if (chatStatus === 'submitted' || chatStatus === 'streaming') {
      status.value = chatStatus
    }
  }

  function startSync() {
    stopSync()
    syncInterval = setInterval(syncMessages, 80)
  }

  function stopSync() {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  }

  function sendInstruction(instruction: string) {
    if (!instruction.trim()) return
    isAgentRunning.value = true
    status.value = 'submitted'
    streamDone = false
    activeToolCalls = 0
    if (finishCheckTimer) clearTimeout(finishCheckTimer)
    chat.sendMessage({ text: instruction })
    nextTick(syncMessages)
    startSync()
  }

  function stop() {
    chat.stop()
    isAgentRunning.value = false
    status.value = 'ready'
    activeToolCalls = 0
    streamDone = false
    if (finishCheckTimer) clearTimeout(finishCheckTimer)
    syncMessages()
    stopSync()
  }

  function getMessages(): UIMessage[] {
    return chat.messages.map(m => ({
      ...m,
      parts: m.parts.map((p: any) => ({ ...p })),
    }))
  }

  function resetChat(initialMessages: UIMessage[] = []) {
    stop()
    chat.messages = initialMessages
    messages.value = [...initialMessages]
    status.value = 'ready'
    isAgentRunning.value = false
  }

  onUnmounted(() => {
    stopSync()
    if (finishCheckTimer) clearTimeout(finishCheckTimer)
  })

  return {
    messages: readonly(messages),
    status: readonly(status),
    isAgentRunning: readonly(isAgentRunning),
    sendInstruction,
    stop,
    getMessages,
    resetChat,
  }
}
