// Module-level singleton so all components share the same reactive state
let _username: Ref<string> | null = null
let _profilePicture: Ref<string> | null = null
let _geminiApiKey: Ref<string> | null = null
let _openRouterApiKey: Ref<string> | null = null
let _selectedModel: Ref<string> | null = null
let _isLoggedIn: Ref<boolean> | null = null

export function useSettings() {
  if (!_username) {
    _username = ref(import.meta.client ? (localStorage.getItem('binb:username') ?? 'User') : 'User')
    if (import.meta.client) {
      watch(_username, (val) => localStorage.setItem('binb:username', val))
    }
  }

  if (!_profilePicture) {
    _profilePicture = ref(import.meta.client ? (localStorage.getItem('binb:profilePicture') ?? '') : '')
    if (import.meta.client) {
      watch(_profilePicture, (val) => localStorage.setItem('binb:profilePicture', val ?? ''))
    }
  }

  if (!_geminiApiKey) {
    _geminiApiKey = ref(import.meta.client ? (localStorage.getItem('binb:geminiApiKey') ?? '') : '')
    if (import.meta.client) {
      watch(_geminiApiKey, (val) => localStorage.setItem('binb:geminiApiKey', val))
    }
  }

  if (!_openRouterApiKey) {
    _openRouterApiKey = ref(import.meta.client ? (localStorage.getItem('binb:openRouterApiKey') ?? '') : '')
    if (import.meta.client) {
      watch(_openRouterApiKey, (val) => localStorage.setItem('binb:openRouterApiKey', val))
    }
  }

  if (!_selectedModel) {
    _selectedModel = ref(import.meta.client ? (localStorage.getItem('binb:selectedModel') ?? 'gemini:gemini-2.5-flash') : 'gemini:gemini-2.5-flash')
    if (import.meta.client) {
      watch(_selectedModel, (val) => localStorage.setItem('binb:selectedModel', val))
    }
  }

  if (!_isLoggedIn) {
    _isLoggedIn = ref(import.meta.client ? (localStorage.getItem('binb:isLoggedIn') === 'true') : false)
    if (import.meta.client) {
      watch(_isLoggedIn, (val) => localStorage.setItem('binb:isLoggedIn', String(val)))
    }
  }

  return {
    username: _username as Ref<string>,
    profilePicture: _profilePicture as Ref<string>,
    geminiApiKey: _geminiApiKey as Ref<string>,
    openRouterApiKey: _openRouterApiKey as Ref<string>,
    selectedModel: _selectedModel as Ref<string>,
    isLoggedIn: _isLoggedIn as Ref<boolean>,
  }
}
