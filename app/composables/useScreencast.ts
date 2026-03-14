export function useScreencast() {
  const currentFrame = ref<string | null>(null)
  const isStreaming = ref(false)
  const pageBackgroundColor = ref<string | null>(null)

  // TODO: Connect to remote WebSocket and push base64 JPEG frames to currentFrame
  // Expected frame format: `data:image/jpeg;base64,<data>`

  function start() {
    isStreaming.value = true
  }

  function stop() {
    isStreaming.value = false
    currentFrame.value = null
    pageBackgroundColor.value = null
  }

  onUnmounted(() => {
    if (isStreaming.value) stop()
  })

  return {
    currentFrame: readonly(currentFrame),
    isStreaming: readonly(isStreaming),
    pageBackgroundColor: readonly(pageBackgroundColor),
    start,
    stop,
  }
}
