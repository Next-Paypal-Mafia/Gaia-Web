import { ref, computed, watch, type Ref } from 'vue'
import { useSettings } from './useSettings'

let _requestCount: Ref<number> | null = null

export function useUsage() {
  const settings = useSettings()

  if (!_requestCount) {
    const stored = import.meta.client ? localStorage.getItem('jellybyte:requestCount') : null
    _requestCount = ref(stored ? parseInt(stored) : 0)
    
    if (import.meta.client) {
      watch(_requestCount, (val) => {
        localStorage.setItem('jellybyte:requestCount', String(val))
      })
    }
  }

  const limit = computed(() => {
    return settings.isLoggedIn.value ? 3 : 1
  })

  const remaining = computed(() => {
    return Math.max(0, limit.value - (_requestCount?.value ?? 0))
  })

  const canRequest = computed(() => {
    return remaining.value > 0
  })

  const usagePercentage = computed(() => {
    return Math.min(100, ((_requestCount?.value ?? 0) / limit.value) * 100)
  })

  function incrementUsage() {
    if (_requestCount) {
      _requestCount.value++
    }
  }

  function resetUsage() {
    if (_requestCount) {
      _requestCount.value = 0
    }
  }

  return {
    requestCount: _requestCount as Ref<number>,
    limit,
    remaining,
    canRequest,
    usagePercentage,
    incrementUsage,
    resetUsage
  }
}
