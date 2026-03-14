// Module-level singleton so all components share the same reactive state
let _username: Ref<string> | null = null
let _profilePicture: Ref<string> | null = null
let _isLoggedIn: Ref<boolean> | null = null

export function useSettings() {
  if (!_username) {
    _username = ref(import.meta.client ? (localStorage.getItem('gaia:username') ?? 'User') : 'User')
    if (import.meta.client) {
      watch(_username, (val) => localStorage.setItem('gaia:username', val))
    }
  }

  if (!_profilePicture) {
    _profilePicture = ref(import.meta.client ? (localStorage.getItem('gaia:profilePicture') ?? '') : '')
    if (import.meta.client) {
      watch(_profilePicture, (val) => localStorage.setItem('gaia:profilePicture', val ?? ''))
    }
  }

  if (!_isLoggedIn) {
    _isLoggedIn = ref(import.meta.client ? (localStorage.getItem('gaia:isLoggedIn') === 'true') : false)
    if (import.meta.client) {
      watch(_isLoggedIn, (val) => localStorage.setItem('gaia:isLoggedIn', String(val)))
    }
  }

  return {
    username: _username as Ref<string>,
    profilePicture: _profilePicture as Ref<string>,
    isLoggedIn: _isLoggedIn as Ref<boolean>,
  }
}
