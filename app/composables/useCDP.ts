type CDPEventHandler = (params: any) => void

interface CDPPendingRequest {
  resolve: (result: any) => void
  reject: (error: Error) => void
}

export function useCDP() {
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  const error = ref<string | null>(null)

  let nextId = 1
  const pendingRequests = new Map<number, CDPPendingRequest>()
  const eventHandlers = new Map<string, Set<CDPEventHandler>>()

  function connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
          ws.value = socket
          connected.value = true
          error.value = null
          resolve()
        }

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if ('id' in data) {
              const pending = pendingRequests.get(data.id)
              if (pending) {
                pendingRequests.delete(data.id)
                if (data.error) {
                  pending.reject(new Error(data.error.message))
                } else {
                  pending.resolve(data.result)
                }
              }
            } else if ('method' in data) {
              const handlers = eventHandlers.get(data.method)
              if (handlers) {
                for (const handler of handlers) {
                  handler(data.params)
                }
              }
            }
          } catch (e) {
            console.error('CDP message parse error:', e)
          }
        }

        socket.onerror = () => {
          error.value = 'WebSocket connection error'
          connected.value = false
        }

        socket.onclose = () => {
          connected.value = false
          ws.value = null
          for (const [, pending] of pendingRequests) {
            pending.reject(new Error('Connection closed'))
          }
          pendingRequests.clear()
        }
      } catch (e) {
        error.value = `Failed to connect: ${e}`
        reject(e)
      }
    })
  }

  function send<T = any>(method: string, params?: Record<string, any>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to CDP'))
        return
      }

      const id = nextId++
      pendingRequests.set(id, { resolve, reject })

      ws.value.send(JSON.stringify({ id, method, params }))

      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id)
          reject(new Error(`CDP request timeout: ${method}`))
        }
      }, 30_000)
    })
  }

  function on(event: string, handler: CDPEventHandler) {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set())
    }
    eventHandlers.get(event)!.add(handler)
  }

  function off(event: string, handler: CDPEventHandler) {
    eventHandlers.get(event)?.delete(handler)
  }

  function disconnect() {
    ws.value?.close()
    ws.value = null
    connected.value = false
    pendingRequests.clear()
    eventHandlers.clear()
  }

  async function enableDomains() {
    await Promise.all([
      send('Page.enable'),
      send('DOM.enable'),
      send('Runtime.enable'),
      send('Accessibility.enable'),
    ])
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    connected: readonly(connected),
    error: readonly(error),
    connect,
    send,
    on,
    off,
    disconnect,
    enableDomains,
  }
}
