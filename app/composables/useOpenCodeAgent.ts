export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<Record<string, any>>
}

// Tracks active assistant message parts indexed by messageID
interface AssistantBuffer {
  messageID: string
  uiId: string
  parts: Array<Record<string, any>>
}

export function useOpenCodeAgent() {
  const messages = shallowRef<UIMessage[]>([])
  const isAgentRunning = ref(false)
  const status = ref<'ready' | 'submitted' | 'streaming' | 'error'>('ready')
  const sessionId = ref<string | null>(null)

  // Internal state — not exposed
  let _baseUrl = ''
  let _token: string | undefined
  let _eventSource: EventSource | null = null
  let _assistantBuffer: AssistantBuffer | null = null
  // Guards against stale SSE events reaching messages after a resetChat.
  // Set to true only inside sendInstruction; resetChat sets it to false.
  let _acceptParts = false

  // ── SSE event processing ───────────────────────────────────────────────────

  function _handleSSEEvent(raw: string) {
    let evt: { type: string; properties?: Record<string, any> }
    try {
      evt = JSON.parse(raw)
    }
    catch {
      return
    }

    const { type, properties } = evt

    if (type === 'server.connected') {
      // Initial handshake — connection is up
      return
    }

    if (type === 'message.part.updated' && properties) {
      _handlePartUpdated(properties)
      return
    }

    if (type === 'session.idle') {
      if (_acceptParts) _finaliseAssistantMessage()
      _acceptParts = false
      isAgentRunning.value = false
      status.value = 'ready'
      return
    }

    if (type === 'session.error') {
      if (_acceptParts) _finaliseAssistantMessage()
      _acceptParts = false
      isAgentRunning.value = false
      status.value = 'error'
      return
    }
  }

  function _handlePartUpdated(properties: Record<string, any>) {
    if (!_acceptParts) return

    const part = properties.part as Record<string, any> | undefined
    if (!part) return

    const messageID = (part.messageID ?? properties.messageID) as string | undefined
    if (!messageID) return

    // First part received — transition to streaming
    if (status.value === 'submitted') {
      status.value = 'streaming'
    }

    // If messageID changed, finalise the previous buffer and start a new one
    if (_assistantBuffer && _assistantBuffer.messageID !== messageID) {
      _finaliseAssistantMessage()
    }

    // Initialise buffer for this messageID
    if (!_assistantBuffer) {
      const uiId = `assistant-${messageID}`
      _assistantBuffer = { messageID, uiId, parts: [] }
      // Append a new empty assistant message immediately so the UI can show it
      messages.value = [
        ...messages.value,
        { id: uiId, role: 'assistant', parts: [] },
      ]
    }

    // Merge the incoming part into the buffer
    _mergePart(_assistantBuffer, part)

    // Update the live assistant message in the messages array
    _flushBuffer()
  }

  function _mergePart(buffer: AssistantBuffer, part: Record<string, any>) {
    const partType: string = part.type ?? ''

    if (partType === 'text') {
      // Find an existing text part and append to it, or add a new one
      const existing = buffer.parts.find(p => p.type === 'text')
      if (existing) {
        existing.text = (existing.text ?? '') + (part.text ?? '')
      }
      else {
        buffer.parts.push({ type: 'text', text: part.text ?? '' })
      }
      return
    }

    if (partType === 'reasoning') {
      const existing = buffer.parts.find(p => p.type === 'reasoning')
      if (existing) {
        existing.text = (existing.text ?? '') + (part.text ?? '')
      }
      else {
        buffer.parts.push({ type: 'reasoning', text: part.text ?? '' })
      }
      return
    }

    if (partType === 'step-start') {
      buffer.parts.push({ type: 'step-start' })
      return
    }

    if (partType === 'tool') {
      // SDK ToolPart shape: { tool: string, callID: string, state: { status, input, output, ... } }
      const toolName: string = part.tool ?? part.toolName ?? 'unknown'
      const callID: string = part.callID ?? part.toolCallId ?? part.id ?? ''
      const toolUiType = `tool-${toolName}`
      const existing = buffer.parts.find(
        p => p.type === toolUiType && p._callID === callID,
      )
      if (existing) {
        // Merge the whole state object as it arrives
        if (part.state !== undefined) existing.state = part.state
      }
      else {
        buffer.parts.push({
          type: toolUiType,
          toolName,
          state: part.state ?? { status: 'pending', input: {}, raw: '' },
          _callID: callID,
        })
      }
      return
    }

    // Catch-all: include unknown part types as-is
    buffer.parts.push({ ...part })
  }

  function _flushBuffer() {
    if (!_assistantBuffer) return
    const { uiId, parts } = _assistantBuffer
    messages.value = messages.value.map(m =>
      m.id === uiId ? { ...m, parts: [...parts] } : m,
    )
  }

  function _finaliseAssistantMessage() {
    if (_assistantBuffer) {
      _flushBuffer()
      _assistantBuffer = null
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function connect(baseUrl: string, token?: string): Promise<void> {
    _baseUrl = baseUrl.replace(/\/$/, '')
    _token = token

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let res: Response
    try {
      res = await fetch(`${_baseUrl}/sessions`, {
        method: 'POST',
        headers,
      })
    }
    catch (err) {
      console.error('[useOpenCodeAgent] Network error creating session (CORS / unreachable?):', err)
      status.value = 'error'
      return
    }

    if (!res.ok) {
      const body = await res.text()
      console.error('[useOpenCodeAgent] Failed to create session:', res.status, body)
      status.value = 'error'
      return
    }

    const data = await res.json() as { sessionId: string }
    sessionId.value = data.sessionId

    const sseUrl = new URL(`${_baseUrl}/sessions/${data.sessionId}/event`)
    if (token) sseUrl.searchParams.set('token', token)

    const es = new EventSource(sseUrl.toString())
    _eventSource = es

    es.onmessage = (e) => {
      _handleSSEEvent(e.data)
    }

    es.onerror = (e) => {
      console.error('[useOpenCodeAgent] SSE error', e)
      if (isAgentRunning.value) {
        isAgentRunning.value = false
        status.value = 'error'
      }
    }

    status.value = 'ready'
  }

  async function disconnect(): Promise<void> {
    // Close SSE
    if (_eventSource) {
      _eventSource.close()
      _eventSource = null
    }

    // Delete the server session
    if (sessionId.value) {
      const headers: Record<string, string> = {}
      if (_token) headers['Authorization'] = `Bearer ${_token}`

      try {
        await fetch(`${_baseUrl}/sessions/${sessionId.value}`, {
          method: 'DELETE',
          headers,
        })
      }
      catch (err) {
        console.warn('[useOpenCodeAgent] Failed to delete session:', err)
      }
    }

    // Reset state
    sessionId.value = null
    isAgentRunning.value = false
    status.value = 'ready'
    _assistantBuffer = null
    _baseUrl = ''
    _token = undefined
  }

  async function sendInstruction(text: string): Promise<void> {
    if (!text.trim()) return
    // Append user message optimistically (even if backend isn't connected yet)
    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: text.trim() }],
    }
    messages.value = [...messages.value, userMsg]

    if (!sessionId.value) {
      console.error('[useOpenCodeAgent] No active session — call connect() first')
      messages.value = [
        ...messages.value,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'I can’t run the browser agent yet because the backend session is not connected. Please configure `NUXT_PUBLIC_AGENT_API_URL` and ensure the agent server is running.',
            },
          ],
        },
      ]
      isAgentRunning.value = false
      status.value = 'error'
      return
    }

    isAgentRunning.value = true
    status.value = 'submitted'
    _assistantBuffer = null
    _acceptParts = true

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`
    }

    try {
      const res = await fetch(
        `${_baseUrl}/sessions/${sessionId.value}/message/async`,
        {
          method: 'POST',
          headers,
          // No model field — server controls the model via opencode.json
          body: JSON.stringify({
            parts: [{ type: 'text', text: text.trim() }],
          }),
        },
      )

      if (!res.ok) {
        const body = await res.text()
        console.error('[useOpenCodeAgent] Failed to send message:', res.status, body)
        isAgentRunning.value = false
        status.value = 'error'
      }
      // 204 No Content — response will arrive via SSE
    }
    catch (err) {
      console.error('[useOpenCodeAgent] Network error sending message:', err)
      isAgentRunning.value = false
      status.value = 'error'
    }
  }

  async function stop(): Promise<void> {
    if (!sessionId.value || !isAgentRunning.value) {
      isAgentRunning.value = false
      status.value = 'ready'
      return
    }

    const headers: Record<string, string> = {}
    if (_token) headers['Authorization'] = `Bearer ${_token}`

    try {
      await fetch(`${_baseUrl}/sessions/${sessionId.value}/abort`, {
        method: 'POST',
        headers,
      })
    }
    catch (err) {
      console.warn('[useOpenCodeAgent] Abort request failed:', err)
    }

    _finaliseAssistantMessage()
    isAgentRunning.value = false
    status.value = 'ready'
  }

  function getMessages(): UIMessage[] {
    return [...messages.value]
  }

  function resetChat(initialMessages: UIMessage[] = []) {
    _acceptParts = false
    _assistantBuffer = null
    isAgentRunning.value = false
    status.value = 'ready'
    messages.value = [...initialMessages]
  }

  return {
    messages: readonly(messages),
    status: readonly(status),
    isAgentRunning: readonly(isAgentRunning),
    sessionId: readonly(sessionId),
    connect,
    disconnect,
    sendInstruction,
    stop,
    getMessages,
    resetChat,
  }
}
