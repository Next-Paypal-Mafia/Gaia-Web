export interface SavedCredential {
  id: string
  /** Shown on the tile (e.g. "GitHub") */
  name: string
  /** Login URL or app URL */
  url: string
  username: string
  password?: string
  password_secret_id?: string
  updatedAt: number
}

const STORAGE_KEY = 'jellybyte:authentications'

function loadJSON(): SavedCredential[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedCredential[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveJSON(items: SavedCredential[]) {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function clearJSON() {
  if (!import.meta.client) return
  localStorage.removeItem(STORAGE_KEY)
}

/** Normalize DB value: jsonb array or single jsonb array payload */
function normalizeCredentials(raw: unknown): SavedCredential[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : []
  const out: SavedCredential[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : `auth-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const name = typeof o.name === 'string' ? o.name : ''
    const url = typeof o.url === 'string' ? o.url : ''
    const username = typeof o.username === 'string' ? o.username : ''
    const password = typeof o.password === 'string' ? o.password : ''
    const password_secret_id = typeof o.password_secret_id === 'string' ? o.password_secret_id : undefined
    const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : Date.now()
    if (!url && !name) continue
    out.push({ id, name, url, username, password, password_secret_id, updatedAt })
  }
  return out
}

let _credentials: Ref<SavedCredential[]> | null = null
let _syncState: Ref<'idle' | 'loading' | 'saving' | 'error'> | null = null
let _syncError: Ref<string | null> | null = null
let _suppressPersist = false
let _saveTimer: ReturnType<typeof setTimeout> | null = null

export function useAuthentications() {
  if (!_credentials) {
    _credentials = ref<SavedCredential[]>([])
    _syncState = ref<'idle' | 'loading' | 'saving' | 'error'>('idle')
    _syncError = ref<string | null>(null)

    if (import.meta.client) {
      const supabase = useSupabaseClient()
      const settings = useSettings()

      async function saveToSupabase(list: SavedCredential[]) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        _syncState!.value = 'saving'
        _syncError!.value = null
        const payload = list.map(c => {
          const out: Record<string, any> = {
            id: c.id,
            name: c.name,
            url: c.url,
            username: c.username,
            updatedAt: c.updatedAt,
          }
          if (c.password) out.password = c.password
          if (c.password_secret_id) out.password_secret_id = c.password_secret_id
          return out
        })
        
        // We use an RPC call so the Postgres backend can securely move new passwords into Vault.
        // @ts-ignore - 'sync_vault_credentials' isn't in generated Database types yet
        const { error } = await (supabase.rpc as any)('sync_vault_credentials', { payload })
        if (error) {
          console.error('[useAuthentications] Supabase save failed:', error)
          _syncState!.value = 'error'
          _syncError!.value = error.message
        } else {
          _syncState!.value = 'idle'
        }
      }

      function scheduleRemoteSave() {
        if (_suppressPersist || !settings.isLoggedIn.value) return
        if (_saveTimer) clearTimeout(_saveTimer)
        _saveTimer = setTimeout(() => {
          _saveTimer = null
          void saveToSupabase(_credentials!.value)
        }, 450)
      }

      async function hydrate() {
        if (!settings.isLoggedIn.value) {
          _suppressPersist = true
          _credentials!.value = loadJSON()
          _suppressPersist = false
          _syncState!.value = 'idle'
          _syncError!.value = null
          return
        }

        _syncState!.value = 'loading'
        _syncError!.value = null
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          _credentials!.value = loadJSON()
          _syncState!.value = 'idle'
          return
        }

        const { data, error } = await supabase
          .from('users')
          .select('credentials')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          console.error('[useAuthentications] Supabase fetch failed:', error)
          _syncState!.value = 'error'
          _syncError!.value = error.message
          _credentials!.value = loadJSON()
          return
        }

        let list = normalizeCredentials((data as any)?.credentials)

        // Migrate existing local-only data when cloud is empty
        if (list.length === 0) {
          const local = loadJSON()
          if (local.length > 0) {
            list = local
            _suppressPersist = true
            _credentials!.value = [...list]
            _suppressPersist = false
            await saveToSupabase(list)
            clearJSON()
            _syncState!.value = 'idle'
            return
          }
        }

        _suppressPersist = true
        _credentials!.value = list
        _suppressPersist = false
        clearJSON()
        _syncState!.value = 'idle'
      }

      watch(
        () => settings.isLoggedIn.value,
        async (loggedIn) => {
          if (!loggedIn) {
            if (_saveTimer) {
              clearTimeout(_saveTimer)
              _saveTimer = null
            }
            _suppressPersist = true
            _credentials!.value = loadJSON()
            _suppressPersist = false
            _syncState!.value = 'idle'
            _syncError!.value = null
            return
          }
          await hydrate()
        },
        { immediate: true },
      )

      watch(
        _credentials,
        (list) => {
          if (_suppressPersist) return
          if (settings.isLoggedIn.value) {
            scheduleRemoteSave()
          } else {
            saveJSON(list)
          }
        },
        { deep: true },
      )

    }
  }

  const credentials = _credentials as Ref<SavedCredential[]>
  const syncState = _syncState as Ref<'idle' | 'loading' | 'saving' | 'error'>
  const syncError = _syncError as Ref<string | null>

  function addCredential(entry: Omit<SavedCredential, 'id' | 'updatedAt'>) {
    const id = `auth-${Date.now()}`
    credentials.value = [
      {
        id,
        ...entry,
        updatedAt: Date.now(),
      },
      ...credentials.value,
    ]
    return id
  }

  function updateCredential(id: string, patch: Partial<Omit<SavedCredential, 'id'>>) {
    const idx = credentials.value.findIndex(c => c.id === id)
    if (idx === -1) return
    const next = { ...credentials.value[idx], ...patch, updatedAt: Date.now() } as SavedCredential
    credentials.value = credentials.value.map(c => (c.id === id ? next : c))
  }

  function removeCredential(id: string) {
    credentials.value = credentials.value.filter(c => c.id !== id)
  }

  return {
    credentials,
    syncState,
    syncError,
    addCredential,
    updateCredential,
    removeCredential,
  }
}

/** Favicon URL for a site (Google's service). */
export function credentialFaviconUrl(url: string): string | null {
  if (!url?.trim()) return null
  try {
    const normalized = url.includes('://') ? url : `https://${url}`
    const host = new URL(normalized).hostname
    if (!host) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
  } catch {
    return null
  }
}

export function hostnameLabel(url: string): string {
  if (!url?.trim()) return 'Website'
  try {
    const normalized = url.includes('://') ? url : `https://${url}`
    return new URL(normalized).hostname.replace(/^www\./, '') || 'Website'
  } catch {
    return 'Website'
  }
}
