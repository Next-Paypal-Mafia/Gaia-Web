import type { UIMessage } from "~/composables/useOpenCodeAgent"

export const CHAT_STATE_STORAGE_KEY = "jellybyte:chat-state:v1"

export interface PersistedChatStateV1 {
  version: 1
  chatHistory: Array<{ id: string; title: string }>
  chatSessions: Record<string, UIMessage[]>
  activeChatId: string
  streamingChatId: string
  browserRevealed: boolean
  dismissedFeedbackIds: string[]
}

const DEFAULT_ID = "chat-1"

const DEFAULT_BOOTSTRAP: Omit<PersistedChatStateV1, "version"> = {
  chatHistory: [{ id: DEFAULT_ID, title: "New chat" }],
  chatSessions: { [DEFAULT_ID]: [] },
  activeChatId: DEFAULT_ID,
  streamingChatId: DEFAULT_ID,
  browserRevealed: false,
  dismissedFeedbackIds: [],
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isValidMessage(m: unknown): m is UIMessage {
  if (!isPlainObject(m)) return false
  if (m.role !== "user" && m.role !== "assistant") return false
  if (typeof m.id !== "string") return false
  if (!Array.isArray(m.parts)) return false
  return true
}

/** Deep clone messages for safe resetChat / storage round-trip */
export function cloneUIMessages(msgs: UIMessage[]): UIMessage[] {
  try {
    return JSON.parse(JSON.stringify(msgs)) as UIMessage[]
  } catch {
    return []
  }
}

/**
 * Read validated chat UI state from localStorage.
 * After reload we always tie `streamingChatId` to `activeChatId` (one server session).
 */
export function readChatBootstrap(): Omit<PersistedChatStateV1, "version"> {
  if (!import.meta.client) return { ...DEFAULT_BOOTSTRAP }

  try {
    const raw = localStorage.getItem(CHAT_STATE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_BOOTSTRAP }

    const o = JSON.parse(raw) as Partial<PersistedChatStateV1>
    if (o.version !== 1) return { ...DEFAULT_BOOTSTRAP }
    if (!Array.isArray(o.chatHistory) || o.chatHistory.length === 0)
      return { ...DEFAULT_BOOTSTRAP }

    const chatHistory = o.chatHistory
      .filter(
        (c): c is { id: string; title: string } =>
          c != null && typeof c.id === "string" && c.id.length > 0,
      )
      .map(c => ({
        id: c.id,
        title:
          typeof c.title === "string" && c.title.trim().length > 0
            ? c.title
            : "New chat",
      }))
    if (!chatHistory.length) return { ...DEFAULT_BOOTSTRAP }

    const chatSessions: Record<string, UIMessage[]> = {}
    for (const c of chatHistory) chatSessions[c.id] = []

    const rawSessions = o.chatSessions
    if (isPlainObject(rawSessions)) {
      for (const id of Object.keys(rawSessions)) {
        if (!chatSessions[id]) continue
        const arr = rawSessions[id]
        if (!Array.isArray(arr)) continue
        const cleaned: UIMessage[] = []
        for (const m of arr) {
          if (isValidMessage(m))
            cleaned.push(cloneUIMessages([m as UIMessage])[0]!)
        }
        chatSessions[id] = cleaned
      }
    }

    let activeChatId =
      typeof o.activeChatId === "string" && chatHistory.some(c => c.id === o.activeChatId)
        ? o.activeChatId
        : chatHistory[0]!.id

    const streamingChatId = activeChatId

    const msgs = chatSessions[activeChatId] ?? []
    const browserRevealed =
      typeof o.browserRevealed === "boolean"
        ? o.browserRevealed && msgs.length > 0
        : msgs.length > 0

    const dismissedFeedbackIds = Array.isArray(o.dismissedFeedbackIds)
      ? o.dismissedFeedbackIds.filter((x): x is string => typeof x === "string")
      : []

    return {
      chatHistory,
      chatSessions,
      activeChatId,
      streamingChatId,
      browserRevealed,
      dismissedFeedbackIds,
    }
  } catch {
    return { ...DEFAULT_BOOTSTRAP }
  }
}

export function persistChatState(state: PersistedChatStateV1): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn("[useChatLocalPersistence] Failed to save:", e)
  }
}

export function buildPersistedPayload(
  chatHistory: Array<{ id: string; title: string }>,
  chatSessions: Record<string, UIMessage[]>,
  activeChatId: string,
  streamingChatId: string,
  browserRevealed: boolean,
  dismissedFeedbackIds: string[],
): PersistedChatStateV1 {
  const sessions: Record<string, UIMessage[]> = {}
  for (const id of Object.keys(chatSessions)) {
    sessions[id] = cloneUIMessages(chatSessions[id] ?? [])
  }
  return {
    version: 1,
    chatHistory: chatHistory.map(c => ({ id: c.id, title: c.title })),
    chatSessions: sessions,
    activeChatId,
    streamingChatId,
    browserRevealed,
    dismissedFeedbackIds: [...dismissedFeedbackIds],
  }
}