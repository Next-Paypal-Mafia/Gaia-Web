// Module-level singleton so all components share the same reactive state
let _username: Ref<string> | null = null
let _profilePicture: Ref<string> | null = null
let _isLoggedIn: Ref<boolean> | null = null
let _shareLocationWithBackend: Ref<boolean> | null = null

export function useSettings() {
  if (!_username) {
    _username = ref(import.meta.client ? (localStorage.getItem('jellybyte:username') ?? 'User') : 'User')
    if (import.meta.client) {
      watch(_username, (val) => localStorage.setItem('jellybyte:username', val))
    }
  }

  if (!_profilePicture) {
    _profilePicture = ref(import.meta.client ? (localStorage.getItem('jellybyte:profilePicture') ?? '') : '')
    if (import.meta.client) {
      watch(_profilePicture, (val) => localStorage.setItem('jellybyte:profilePicture', val ?? ''))
    }
  }

  if (!_isLoggedIn) {
    _isLoggedIn = ref(import.meta.client ? (localStorage.getItem('jellybyte:isLoggedIn') === 'true') : false)
    if (import.meta.client) {
      watch(_isLoggedIn, (val) => localStorage.setItem('jellybyte:isLoggedIn', String(val)))
    }
  }

  if (!_shareLocationWithBackend) {
    _shareLocationWithBackend = ref(
      import.meta.client ? localStorage.getItem('jellybyte:shareLocationWithBackend') === 'true' : false,
    )
    if (import.meta.client) {
      watch(_shareLocationWithBackend, (val) =>
        localStorage.setItem('jellybyte:shareLocationWithBackend', String(val)),
      )
    }
  }

  return {
    username: _username as Ref<string>,
    profilePicture: _profilePicture as Ref<string>,
    isLoggedIn: _isLoggedIn as Ref<boolean>,
    /** When true (and signed in), client reports coarse location to the agent server on an interval */
    shareLocationWithBackend: _shareLocationWithBackend as Ref<boolean>,
  }
}
