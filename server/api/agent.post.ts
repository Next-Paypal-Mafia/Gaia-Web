import { streamText, convertToModelMessages } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { browserTools } from '../utils/browser-tools'

const SYSTEM_PROMPT = `You are Gaia, a browser automation agent. You control a real web browser to complete tasks for the user.

## How you work
1. First, use getPageState to see what's currently on screen.
2. Decide which action to take based on the page's accessibility tree.
3. Execute the action (navigate, click, type, etc.).
4. Observe the result and continue until the task is complete.

## Rules
- When the user asks to go to a site (e.g. "go to YouTube", "open google.com"), use the navigate tool immediately with the full URL (e.g. https://youtube.com).
- For other actions, call getPageState first to understand the current page before taking action.
- Use clickElement with a text description to click buttons, links, and inputs.
- After clicking an input field, use typeText to enter text.
- Press Enter after typing in search fields or forms.
- Use waitForLoad after navigation actions if the page needs time to load.
- When the task is complete, provide a clear summary of what you did and the result.
- If you encounter an error or can't find an element, try a different approach.
- Be concise in your responses — focus on actions and results.`

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const selectedModel = getHeader(event, 'x-selected-model') || 'gemini:gemini-2.5-flash'
  const [provider, modelId] = selectedModel.includes(':') ? selectedModel.split(':', 2) : ['gemini', selectedModel]

  let model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>

  if (provider === 'openrouter') {
    const apiKey = getHeader(event, 'x-openrouter-api-key')
    if (!apiKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'OpenRouter model selected but no OpenRouter API key found. Add one in Settings → Provider.',
      })
    }
    const openrouter = createOpenRouter({ apiKey })
    model = openrouter.chat(modelId)
  } else {
    const apiKey = getHeader(event, 'x-gemini-api-key') || config.googleGenerativeAiApiKey
    if (!apiKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No Gemini API key found. Add one in Settings → Provider, or set GOOGLE_GENERATIVE_AI_API_KEY in your .env file.',
      })
    }
    const google = createGoogleGenerativeAI({ apiKey })
    model = google(modelId || 'gemini-2.5-flash')
  }

  const { messages } = await readBody(event)

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    tools: browserTools,
    messages: await convertToModelMessages(messages),
  })

  result.pipeUIMessageStreamToResponse(event.node.res)
})
