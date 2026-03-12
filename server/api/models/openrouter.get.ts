export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, 'x-openrouter-api-key')
  if (!apiKey) {
    return { data: [] }
  }

  try {
    const res = await $fetch<{ data: Array<{ id: string; name: string }> }>(
      'https://openrouter.ai/api/v1/models',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    return {
      data: (res.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
      })),
    }
  } catch (err) {
    console.error('[OpenRouter models]', err)
    return { data: [] }
  }
})
