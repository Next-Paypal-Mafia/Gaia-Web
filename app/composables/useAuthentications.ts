interface CredentialSummaryResponse {
  site: string
  username: string
  updatedAt: string
}

export interface SavedCredential {
  id: string
  name: string
  url: string
  username: string
  updatedAt: number
}

function normalizeCredentialSite(input: string): string {
  const trimmed = input.trim().toLowerCase()
  const normalized = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  return new URL(normalized).hostname.replace(/^www\./, "")
}

function mapCredentialSummary(item: CredentialSummaryResponse): SavedCredential {
  return {
    id: item.site,
    name: hostnameLabel(item.site),
    url: item.site,
    username: item.username,
    updatedAt: Date.parse(item.updatedAt) || Date.now(),
  }
}

let _credentials: Ref<SavedCredential[]> | null = null
let _syncState: Ref<"idle" | "loading" | "saving" | "error"> | null = null
let _syncError: Ref<string | null> | null = null

export function useAuthentications() {
  if (!_credentials) {
    _credentials = ref<SavedCredential[]>([])
    _syncState = ref<"idle" | "loading" | "saving" | "error">("idle")
    _syncError = ref<string | null>(null)

    if (import.meta.client) {
      const config = useRuntimeConfig()
      const supabase = useSupabaseClient()
      const settings = useSettings()

      async function getAccessToken(): Promise<string | null> {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token ?? null
      }

      async function requestCredentialsApi<T>(
        path: string,
        init: RequestInit & { body?: unknown } = {},
      ): Promise<T> {
        const apiBase = String(config.public.serverUrl || "").replace(/\/$/, "")
        if (!apiBase) {
          throw new Error("Server URL is not configured")
        }

        const token = await getAccessToken()
        if (!token) {
          throw new Error("Authenticated session required")
        }

        const headers = new Headers(init.headers)
        headers.set("Authorization", `Bearer ${token}`)
        if (init.body !== undefined) {
          headers.set("Content-Type", "application/json")
        }

        const res = await fetch(`${apiBase}${path}`, {
          ...init,
          headers,
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
          credentials: "omit",
        })

        if (!res.ok) {
          const message = await res.text()
          throw new Error(message || `Credential request failed with ${res.status}`)
        }

        if (res.status === 204) {
          return undefined as T
        }

        return await res.json() as T
      }

      async function hydrate() {
        if (!settings.isLoggedIn.value) {
          _credentials!.value = []
          _syncState!.value = "idle"
          _syncError!.value = null
          return
        }

        _syncState!.value = "loading"
        _syncError!.value = null

        try {
          const data = await requestCredentialsApi<CredentialSummaryResponse[]>("/api/credentials")
          _credentials!.value = data
            .map(mapCredentialSummary)
            .sort((a, b) => b.updatedAt - a.updatedAt)
          _syncState!.value = "idle"
        }
        catch (error) {
          console.error("[useAuthentications] Backend fetch failed:", error)
          _credentials!.value = []
          _syncState!.value = "error"
          _syncError!.value = error instanceof Error ? error.message : String(error)
        }
      }

      watch(
        () => settings.isLoggedIn.value,
        async () => {
          await hydrate()
        },
        { immediate: true },
      )
    }
  }

  const config = useRuntimeConfig()
  const supabase = useSupabaseClient()
  const credentials = _credentials as Ref<SavedCredential[]>
  const syncState = _syncState as Ref<"idle" | "loading" | "saving" | "error">
  const syncError = _syncError as Ref<string | null>

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function requestCredentialsApi<T>(
    path: string,
    init: RequestInit & { body?: unknown } = {},
  ): Promise<T> {
    const apiBase = String(config.public.serverUrl || "").replace(/\/$/, "")
    if (!apiBase) {
      throw new Error("Server URL is not configured")
    }

    const token = await getAccessToken()
    if (!token) {
      throw new Error("Authenticated session required")
    }

    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${token}`)
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json")
    }

    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "omit",
    })

    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || `Credential request failed with ${res.status}`)
    }

    if (res.status === 204) {
      return undefined as T
    }

    return await res.json() as T
  }

  async function refreshCredentials() {
    syncState.value = "loading"
    syncError.value = null

    try {
      const data = await requestCredentialsApi<CredentialSummaryResponse[]>("/api/credentials")
      credentials.value = data
        .map(mapCredentialSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      syncState.value = "idle"
    }
    catch (error) {
      syncState.value = "error"
      syncError.value = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  async function addCredential(entry: {
    name: string
    url: string
    username: string
    password: string
  }) {
    syncState.value = "saving"
    syncError.value = null

    try {
      const site = normalizeCredentialSite(entry.url)
      await requestCredentialsApi(`/api/credentials/${encodeURIComponent(site)}`, {
        method: "POST",
        body: {
          username: entry.username.trim(),
          password: entry.password,
        },
      })
      await refreshCredentials()
    }
    catch (error) {
      syncState.value = "error"
      syncError.value = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  async function updateCredential(
    id: string,
    patch: {
      name: string
      url: string
      username: string
      password: string
    },
  ) {
    syncState.value = "saving"
    syncError.value = null

    try {
      const nextSite = normalizeCredentialSite(patch.url)
      await requestCredentialsApi(`/api/credentials/${encodeURIComponent(nextSite)}`, {
        method: "POST",
        body: {
          username: patch.username.trim(),
          password: patch.password,
        },
      })

      if (id !== nextSite) {
        await requestCredentialsApi(`/api/credentials/${encodeURIComponent(id)}`, {
          method: "DELETE",
        })
      }

      await refreshCredentials()
    }
    catch (error) {
      syncState.value = "error"
      syncError.value = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  async function removeCredential(id: string) {
    syncState.value = "saving"
    syncError.value = null

    try {
      await requestCredentialsApi(`/api/credentials/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      await refreshCredentials()
    }
    catch (error) {
      syncState.value = "error"
      syncError.value = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  return {
    credentials,
    syncState,
    syncError,
    refreshCredentials,
    addCredential,
    updateCredential,
    removeCredential,
  }
}

export function credentialFaviconUrl(url: string): string | null {
  if (!url?.trim()) return null
  try {
    const normalized = url.includes("://") ? url : `https://${url}`
    const host = new URL(normalized).hostname
    if (!host) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  }
  catch {
    return null
  }
}

export function hostnameLabel(url: string): string {
  if (!url?.trim()) return "Website"
  try {
    const normalized = url.includes("://") ? url : `https://${url}`
    const host = new URL(normalized).hostname.replace(/^www\./, "")
    if (!host) return "Website"
    return host
      .split(".")[0]
      ?.replace(/[-_]+/g, " ")
      .replace(/\b\w/g, ch => ch.toUpperCase()) || host
  }
  catch {
    return url
  }
}
