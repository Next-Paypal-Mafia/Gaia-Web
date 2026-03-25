const INTERVAL_MS = 10 * 60 * 1000

let setupDone = false

/**
 * When the user opts in (settings) and has a Supabase session, POSTs geolocation to
 * `{serverUrl}/user-location` immediately and every 10 minutes.
 */
export function useUserLocationReporting() {
  if (import.meta.server || !import.meta.client || setupDone)
    return
  setupDone = true

  const config = useRuntimeConfig()
  const supabase = useSupabaseClient()
  const settings = useSettings()

  let intervalId: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  async function postOnce(accessToken: string, apiBase: string) {
    const url = `${apiBase.replace(/\/$/, "")}/user-location`
    await new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"))
        return
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = pos.coords
            await $fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: {
                latitude,
                longitude,
                accuracy: Number.isFinite(accuracy) ? accuracy : null,
                altitude: altitude != null && Number.isFinite(altitude) ? altitude : null,
                altitudeAccuracy:
                  altitudeAccuracy != null && Number.isFinite(altitudeAccuracy) ? altitudeAccuracy : null,
                heading: heading != null && Number.isFinite(heading) ? heading : null,
                speed: speed != null && Number.isFinite(speed) ? speed : null,
                recordedAt: new Date(pos.timestamp).toISOString(),
              },
              credentials: "omit",
            })
            resolve()
          }
          catch (e) {
            reject(e)
          }
        },
        (err) => {
          reject(err)
        },
        {
          enableHighAccuracy: false,
          maximumAge: 120_000,
          timeout: 25_000,
        },
      )
    })
  }

  async function tick() {
    const apiBase = config.public.serverUrl
    if (!apiBase || !settings.shareLocationWithBackend.value) {
      clearTimer()
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      clearTimer()
      return
    }
    try {
      await postOnce(token, String(apiBase))
    }
    catch (e) {
      console.warn("[jellybyte] user-location report failed:", e)
    }
  }

  async function armOrDisarm() {
    clearTimer()
    const apiBase = config.public.serverUrl
    if (!apiBase || !settings.shareLocationWithBackend.value) {
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return
    }
    await tick()
    intervalId = setInterval(() => {
      void tick()
    }, INTERVAL_MS)
  }

  watch(
    () => [settings.shareLocationWithBackend.value, config.public.serverUrl] as const,
    () => {
      void armOrDisarm()
    },
    { immediate: true },
  )

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT")
      clearTimer()
    else
      void armOrDisarm()
  })

  onScopeDispose(() => {
    clearTimer()
    subscription.unsubscribe()
  })
}
