const REPORT_INTERVAL_MS = 2 * 60 * 1000
const DEFAULT_MAXIMUM_AGE_MS = 120_000
const DEFAULT_TIMEOUT_MS = 25_000
const FOREGROUND_REFRESH_MAXIMUM_AGE_MS = 60_000
const FOREGROUND_REFRESH_TIMEOUT_MS = 5_000

interface LocationReportOptions {
  maximumAgeMs?: number
  timeoutMs?: number
}

let setupDone = false
let reportUserLocationNowImpl: ((options?: LocationReportOptions) => Promise<boolean>) | null = null

function readCurrentPosition(options: LocationReportOptions = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: false,
        maximumAge: options.maximumAgeMs ?? DEFAULT_MAXIMUM_AGE_MS,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
    )
  })
}

export async function reportUserLocationNow(options: LocationReportOptions = {}): Promise<boolean> {
  if (!reportUserLocationNowImpl) {
    return false
  }

  return reportUserLocationNowImpl(options)
}

/**
 * When the user opts in (settings) and has a Supabase session, POSTs geolocation to
 * `{serverUrl}/geolocation` immediately, every 2 minutes, and before new runs start.
 */
export function useUserLocationReporting() {
  if (import.meta.server || !import.meta.client || setupDone)
    return
  setupDone = true

  const config = useRuntimeConfig()
  const compatibility = useServerCompatibility()
  const supabase = useSupabaseClient()
  const settings = useSettings()

  let intervalId: ReturnType<typeof setInterval> | null = null

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  async function postOnce(accessToken: string, apiBase: string, options: LocationReportOptions = {}) {
    const pos = await readCurrentPosition(options)
    const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = pos.coords

    await $fetch(`${apiBase.replace(/\/$/, "")}/geolocation`, {
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
  }

  async function reportLocation(options: LocationReportOptions = {}): Promise<boolean> {
    const apiBase = config.public.serverUrl
    if (!apiBase || !settings.shareLocationWithBackend.value) {
      return false
    }

    const compatibilityState = await compatibility.check()
    if (compatibilityState.status === "incompatible") {
      return false
    }

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      return false
    }

    try {
      await postOnce(token, String(apiBase), options)
      return true
    }
    catch (e) {
      console.warn("[jellybyte] geolocation report failed:", e)
      return false
    }
  }

  reportUserLocationNowImpl = reportLocation

  async function tick() {
    const apiBase = config.public.serverUrl
    if (!apiBase || !settings.shareLocationWithBackend.value) {
      clearTimer()
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      clearTimer()
      return
    }

    await reportLocation()
  }

  async function armOrDisarm() {
    clearTimer()

    const apiBase = config.public.serverUrl
    if (!apiBase || !settings.shareLocationWithBackend.value) {
      return
    }

    const compatibilityState = await compatibility.check()
    if (compatibilityState.status === "incompatible") {
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return
    }

    await tick()
    intervalId = setInterval(() => {
      void tick()
    }, REPORT_INTERVAL_MS)
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== "visible") {
      return
    }

    void reportLocation({
      maximumAgeMs: FOREGROUND_REFRESH_MAXIMUM_AGE_MS,
      timeoutMs: FOREGROUND_REFRESH_TIMEOUT_MS,
    })
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

  document.addEventListener("visibilitychange", handleVisibilityChange)

  onScopeDispose(() => {
    clearTimer()
    subscription.unsubscribe()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
    if (reportUserLocationNowImpl === reportLocation) {
      reportUserLocationNowImpl = null
    }
  })
}
