import type { ApiVersionCheckStatus } from "~/composables/useApiVersion"

type ServerCompatibilityStatus = ApiVersionCheckStatus | "checking"

interface ServerCompatibilityState {
  status: ServerCompatibilityStatus
  serverVersion: string | null
  error: string | null
  checkedAt: number | null
}

let pendingCompatibilityCheck: Promise<ServerCompatibilityState> | null = null

export function useServerCompatibility() {
  const config = useRuntimeConfig()
  const apiVersion = useApiVersion()

  const state = useState<ServerCompatibilityState>("server-compatibility", () => ({
    status: "checking",
    serverVersion: null,
    error: null,
    checkedAt: null,
  }))

  async function check(force = false): Promise<ServerCompatibilityState> {
    if (!force && state.value.checkedAt && state.value.status !== "checking") {
      return state.value
    }

    if (pendingCompatibilityCheck) {
      return pendingCompatibilityCheck
    }

    state.value = {
      ...state.value,
      status: "checking",
      error: null,
    }

    pendingCompatibilityCheck = (async () => {
      const apiUrl = config.public.serverUrl

      if (!apiUrl) {
        state.value = {
          status: "compatible",
          serverVersion: null,
          error: null,
          checkedAt: Date.now(),
        }

        return state.value
      }

      const result = await apiVersion.checkVersion(apiUrl)

      state.value = {
        status: result.status,
        serverVersion: result.serverVersion,
        error: result.error ?? null,
        checkedAt: Date.now(),
      }

      return state.value
    })().finally(() => {
      pendingCompatibilityCheck = null
    })

    return pendingCompatibilityCheck
  }

  const isChecking = computed(() => state.value.status === "checking")
  const isBlocked = computed(() => state.value.status === "incompatible")
  const isCompatible = computed(() => state.value.status === "compatible")

  return {
    state,
    expectedVersion: apiVersion.EXPECTED_API_VERSION,
    isChecking,
    isBlocked,
    isCompatible,
    check,
  }
}
