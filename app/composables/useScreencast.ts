interface ScreencastOptions {
  format?: 'jpeg' | 'png'
  quality?: number
  maxWidth?: number
  maxHeight?: number
  everyNthFrame?: number
}

export function useScreencast(cdp: ReturnType<typeof useCDP>) {
  const currentFrame = ref<string | null>(null)
  const isStreaming = ref(false)
  const frameCount = ref(0)
  const metadata = ref<{ offsetTop: number; pageScaleFactor: number; scrollOffsetX: number; scrollOffsetY: number } | null>(null)
  const pageBackgroundColor = ref<string | null>(null)

  let fetchBgScheduled = false

  async function fetchPageBackgroundColor() {
    try {
      const result = await cdp.send<{ result: { type: string; value?: string } }>('Runtime.evaluate', {
        expression: `(function(){
          const body = getComputedStyle(document.body).backgroundColor;
          const html = getComputedStyle(document.documentElement).backgroundColor;
          const bg = body || html;
          if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return 'rgb(255, 255, 255)';
          return bg;
        })()`,
        returnByValue: true,
      })
      const value = result?.result?.value
      if (typeof value === 'string' && value) {
        pageBackgroundColor.value = value
      }
    } catch {
      // ignore if page not ready or disconnected
    } finally {
      fetchBgScheduled = false
    }
  }

  function scheduleFetchBackground() {
    if (fetchBgScheduled) return
    fetchBgScheduled = true
    fetchPageBackgroundColor()
  }

  function handleFrame(params: any) {
    currentFrame.value = `data:image/jpeg;base64,${params.data}`
    metadata.value = params.metadata
    frameCount.value++
    cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {})
    if (frameCount.value === 1 || frameCount.value % 30 === 0) {
      scheduleFetchBackground()
    }
  }

  async function start(options: ScreencastOptions = {}) {
    cdp.on('Page.screencastFrame', handleFrame)
    cdp.on('Page.loadEventFired', scheduleFetchBackground)

    await cdp.send('Page.startScreencast', {
      format: options.format ?? 'jpeg',
      quality: options.quality ?? 80,
      maxWidth: options.maxWidth ?? 1920,
      maxHeight: options.maxHeight ?? 1080,
      everyNthFrame: options.everyNthFrame ?? 1,
    })

    isStreaming.value = true
  }

  async function stop() {
    isStreaming.value = false
    pageBackgroundColor.value = null
    cdp.off('Page.screencastFrame', handleFrame)
    cdp.off('Page.loadEventFired', scheduleFetchBackground)

    try {
      await cdp.send('Page.stopScreencast')
    } catch {
      // ignore if already stopped
    }
  }

  onUnmounted(() => {
    if (isStreaming.value) stop()
  })

  return {
    currentFrame: readonly(currentFrame),
    isStreaming: readonly(isStreaming),
    frameCount: readonly(frameCount),
    metadata: readonly(metadata),
    pageBackgroundColor: readonly(pageBackgroundColor),
    fetchPageBackgroundColor,
    start,
    stop,
  }
}
