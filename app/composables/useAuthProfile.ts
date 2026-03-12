/**
 * Syncs Supabase auth user (name, avatar) to useSettings.
 * Call this from a component that's always mounted (e.g. app.vue).
 */
export function useAuthProfile() {
  const supabase = useSupabaseClient()
  const settings = useSettings()

  function syncFromUser(user: { user_metadata?: Record<string, unknown>; email?: string } | null) {
    if (user) {
      const meta = user.user_metadata || {}
      const name =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (meta.given_name as string) ||
        user.email?.split('@')[0] ||
        'User'
      const avatar =
        (meta.avatar_url as string) ||
        (meta.picture as string) ||
        ''
      settings.username.value = name
      settings.profilePicture.value = avatar
      settings.isLoggedIn.value = true
    } else {
      settings.username.value = 'User'
      settings.profilePicture.value = ''
      settings.isLoggedIn.value = false
    }
  }

  async function sync() {
    const { data: { user } } = await supabase.auth.getUser()
    syncFromUser(user)
  }

  onMounted(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      syncFromUser(session?.user ?? null)
    })
    sync()
    nextTick(() => sync())
    setTimeout(sync, 500)
    setTimeout(sync, 1500)
  })
}
