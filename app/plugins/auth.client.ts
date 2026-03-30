export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()
  const settings = useSettings()
  const currentPlan = useCurrentPlan()

  async function syncFromUser(user: { id?: string; user_metadata?: Record<string, unknown>; email?: string } | null) {
    if (user) {
      const meta = user.user_metadata || {}
      const name =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (meta.given_name as string) ||
        user.email?.split('@')[0] ||
        'User'
      const avatar = (meta.avatar_url as string) || (meta.picture as string) || ''
      settings.username.value = name
      settings.profilePicture.value = avatar
      settings.isLoggedIn.value = true
      await currentPlan.refresh(user.id || null)
    } else {
      settings.username.value = 'User'
      settings.profilePicture.value = ''
      settings.isLoggedIn.value = false
      await currentPlan.refresh(null)
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    void syncFromUser(session?.user ?? null)
  })

  supabase.auth.getUser().then(({ data: { user } }) => void syncFromUser(user))
})
