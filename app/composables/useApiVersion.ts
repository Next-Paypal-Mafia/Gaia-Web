interface VersionResponse {
  api_version: string
}

export type ApiVersionCheckStatus = "compatible" | "incompatible" | "unreachable"

export interface ApiVersionCheckResult {
  status: ApiVersionCheckStatus
  compatible: boolean
  serverVersion: string | null
  error?: string
}

export function useApiVersion() {
  const appConfig = useAppConfig()
  const EXPECTED_API_VERSION = appConfig.apiVersion

  async function checkVersion(baseUrl: string): Promise<ApiVersionCheckResult> {
    try {
      // Remove trailing slash if present
      const cleanUrl = baseUrl.replace(/\/$/, "")

      const res = await fetch(`${cleanUrl}/version`, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      })

      if (!res.ok) {
        return {
          status: "unreachable",
          compatible: false,
          serverVersion: null,
          error: `Failed to fetch version: ${res.status} ${res.statusText}`
        }
      }

      const data = await res.json() as VersionResponse
      const serverVersion = data.api_version

      if (!serverVersion) {
        return {
          status: "incompatible",
          compatible: false,
          serverVersion: null,
          error: "Missing api_version in response payload"
        }
      }

      const compatible = serverVersion === EXPECTED_API_VERSION

      return {
        status: compatible ? "compatible" : "incompatible",
        compatible,
        serverVersion
      }

    } catch (err: any) {
      console.error("[useApiVersion] Error checking backend version:", err)
      return {
        status: "unreachable",
        compatible: false,
        serverVersion: null,
        error: err.message || "Network error"
      }
    }
  }

  return {
    EXPECTED_API_VERSION,
    checkVersion
  }
}
