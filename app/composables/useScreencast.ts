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
    const url = new URL(`${wsBase}/sessions/${sessionId}/screen`)
    if (token) url.searchParams.set('token', token)

    const ws = new WebSocket(url.toString())
    _ws = ws

    ws.onopen = () => {
      isStreaming.value = true
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string
          data: string
          timestamp: number
        }

        if (msg.type === 'frame' && msg.data) {
          currentFrame.value = `data:image/jpeg;base64,${msg.data}`
        }
      }
      catch {
        // Non-JSON message — ignore
      }
    }

    ws.onclose = () => {
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
  }
}
