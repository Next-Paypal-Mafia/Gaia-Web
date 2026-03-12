export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const port = config.chromeDebugPort || '9222'

  try {
    const response = await fetch(`http://127.0.0.1:${port}/json`)
    if (!response.ok) {
      throw new Error(`Chrome debug endpoint returned ${response.status}`)
    }

    const targets: any[] = await response.json()
    const page = targets.find((t) => t.type === 'page')

    if (!page) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No page target found. Is Chrome running with --remote-debugging-port?',
      })
    }

    return {
      webSocketDebuggerUrl: page.webSocketDebuggerUrl,
      title: page.title,
      url: page.url,
      id: page.id,
    }
  } catch (e: any) {
    if (e.statusCode) throw e

    throw createError({
      statusCode: 503,
      statusMessage: `Cannot connect to Chrome on port ${port}. Run: bun run dev:chrome`,
    })
  }
})
