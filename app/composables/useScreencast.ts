export function useScreencast() {
  const currentFrame = ref<string | null>(null)
  const isStreaming = ref(false)
  const pageBackgroundColor = ref<string | null>(null)

  let _ws: WebSocket | null = null

  function _httpToWs(baseUrl: string): string {
    return baseUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
  }

  function start(baseUrl: string, sessionId: string, token?: string): void {
    // Clean up any existing connection first
    stop()

    const wsBase = _httpToWs(baseUrl.replace(/\/$/, ''))
    const url = new URL(`${wsBase}/sessions/${sessionId}/viewport/screen`)
    if (token) url.searchParams.set('token', token)

    const ws = new WebSocket(url.toString())
    _ws = ws

    ws.onopen = () => {
      console.log('[useScreencast] WebSocket connected to', url.toString())
      isStreaming.value = true
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string
          data?: string
          timestamp: number
          cached?: boolean
        }

        if (msg.type === 'frame' && msg.data) {
          currentFrame.value = `data:image/jpeg;base64,${msg.data}`
        }
        else if (msg.type === 'viewportPending') {
          // Screencaster had no cached frame for the new tab yet; avoid showing the previous target.
          currentFrame.value = null
        }
        else {
          console.log('[useScreencast] Non-frame message:', msg.type)
        }
      }
      catch {
        console.warn('[useScreencast] Non-JSON message received:', typeof event.data, String(event.data).slice(0, 120))
      }
    }

    ws.onclose = (e) => {
      console.warn('[useScreencast] WebSocket closed — code:', e.code, 'reason:', e.reason || '(none)')
      isStreaming.value = false
      _ws = null
    }

    ws.onerror = (e) => {
      console.error('[useScreencast] WebSocket error', e)
      isStreaming.value = false
      currentFrame.value = null
      _ws = null
    }
  }

  /** Drop the last frame so the UI does not show a stale tab while CDP switches targets. */
  function clearFrame(): void {
    currentFrame.value = null
  }

  function stop(): void {
    if (_ws) {
      _ws.onclose = null // Prevent the onclose handler from firing during intentional stop
      _ws.close()
      _ws = null
    }
    isStreaming.value = false
    currentFrame.value = null
    pageBackgroundColor.value = null
  }

  onUnmounted(() => {
    if (isStreaming.value || _ws) stop()
  })

  return {
    currentFrame: readonly(currentFrame),
    isStreaming: readonly(isStreaming),
    pageBackgroundColor: readonly(pageBackgroundColor),
    start,
    stop,
    clearFrame,
  }
}
