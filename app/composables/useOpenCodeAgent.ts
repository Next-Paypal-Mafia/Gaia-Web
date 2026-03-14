export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<Record<string, any>>
}

export function useOpenCodeAgent() {
  const messages = shallowRef<UIMessage[]>([])
  const isAgentRunning = ref(false)
  const status = ref<'ready' | 'submitted' | 'streaming' | 'error'>('ready')

  // TODO: Connect to remote API (replace with real implementation)
  async function connect(url: string) {
    // stub — wire up to the new remote API
  }

  async function sendInstruction(text: string): Promise<void> {
    if (!text.trim()) return

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: text.trim() }],
    }
    messages.value = [...messages.value, userMsg]

    // TODO: Send to remote API and stream response back into messages
  }

  function stop() {
    isAgentRunning.value = false
    status.value = 'ready'
  }

  function getMessages(): UIMessage[] {
    return [...messages.value]
  }

  function resetChat(initialMessages: UIMessage[] = []) {
    stop()
    messages.value = [...initialMessages]
  }

  return {
    messages: readonly(messages),
    status: readonly(status),
    isAgentRunning: readonly(isAgentRunning),
    connect,
    sendInstruction,
    stop,
    getMessages,
    resetChat,
  }
}
