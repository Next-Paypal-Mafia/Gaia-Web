type PlanMetadata = Record<string, unknown>

type CurrentPlan = {
  id: string
  name: string
  metadata: PlanMetadata
}

type UserPlanRow = {
  plan_id: string | null
}

type PlanRow = {
  id: string
  name: string
  metadata: PlanMetadata | null
}

let _plan: Ref<CurrentPlan> | null = null
let _loading: Ref<boolean> | null = null
let _error: Ref<string | null> | null = null
let _refreshPromise: Promise<void> | null = null

function createFallbackPlan(id: string, name: string, metadata: PlanMetadata = {}): CurrentPlan {
  return { id, name, metadata }
}

async function loadPlanById(supabase: ReturnType<typeof useSupabaseClient>, planId: string): Promise<CurrentPlan> {
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, metadata")
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle<PlanRow>()

  if (error) throw error

  if (!data) {
    const fallbackName = planId === "guest" ? "Guest" : "Free"
    return createFallbackPlan(planId, fallbackName)
  }

  return {
    id: data.id,
    name: data.name,
    metadata: data.metadata || {},
  }
}

export function useCurrentPlan() {
  const supabase = useSupabaseClient()

  if (!_plan) {
    _plan = ref(createFallbackPlan("guest", "Guest"))
    _loading = ref(false)
    _error = ref(null)
  }

  async function refresh(userId?: string | null) {
    if (_refreshPromise) return _refreshPromise

    _refreshPromise = (async () => {
      _loading!.value = true
      _error!.value = null

      try {
        if (!userId) {
          _plan!.value = await loadPlanById(supabase, "guest")
          return
        }

        const { data, error } = await supabase
          .from("users")
          .select("plan_id")
          .eq("id", userId)
          .maybeSingle<UserPlanRow>()

        if (error) throw error

        _plan!.value = await loadPlanById(supabase, data?.plan_id || "free")
      } catch (error: any) {
        console.error("[useCurrentPlan] Failed to refresh plan:", error)
        _error!.value = error?.message || "Could not load plan"
        _plan!.value = createFallbackPlan(userId ? "free" : "guest", userId ? "Free" : "Guest")
      } finally {
        _loading!.value = false
        _refreshPromise = null
      }
    })()

    return _refreshPromise
  }

  const featureFlags = computed(() => {
    return Object.entries(_plan!.value.metadata)
      .filter(([, value]) => value === true)
      .map(([key]) => key.replace(/([A-Z])/g, " $1").replace(/^./, char => char.toUpperCase()).trim())
  })

  return {
    plan: _plan as Ref<CurrentPlan>,
    loading: _loading as Ref<boolean>,
    error: _error as Ref<string | null>,
    featureFlags,
    refresh,
  }
}
