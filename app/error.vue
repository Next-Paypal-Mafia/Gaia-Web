<script setup lang="ts">
import type { NuxtError } from "#app"

interface ServerCompatibilityErrorData {
  code?: string
  redirectPath?: string
  expectedVersion?: string
  serverVersion?: string | null
  error?: string | null
}

const props = defineProps<{
  error: NuxtError
}>()

const compatibility = useServerCompatibility()
const retrying = ref(false)

const errorData = computed<ServerCompatibilityErrorData>(() => {
  const data = props.error.data
  return data && typeof data === "object" ? data as ServerCompatibilityErrorData : {}
})

const isCompatibilityError = computed(() =>
  props.error.statusCode === 426 && errorData.value.code === "SERVER_VERSION_MISMATCH",
)

const redirectPath = computed(() =>
  errorData.value.redirectPath || "/",
)

const expectedVersion = computed(() =>
  errorData.value.expectedVersion ?? compatibility.expectedVersion,
)

const serverVersion = computed(() =>
  compatibility.state.value.serverVersion ?? errorData.value.serverVersion ?? null,
)

const diagnostic = computed(() =>
  compatibility.state.value.error ?? errorData.value.error ?? props.error.message ?? null,
)

const title = computed(() =>
  props.error.statusMessage || props.error.message || "Something went wrong",
)

const detail = computed(() => {
  if (typeof props.error.message === "string" && props.error.message.trim()) {
    return props.error.message
  }

  return "The app hit an unexpected error. You can retry or go back to the homepage."
})

async function retryCompatibility() {
  if (!isCompatibilityError.value || retrying.value) {
    return
  }

  retrying.value = true

  try {
    const result = await compatibility.check(true)
    if (result.status === "incompatible") {
      return
    }

    await clearError({ redirect: redirectPath.value })
  }
  finally {
    retrying.value = false
  }
}

async function retryGeneric() {
  await clearError({ redirect: redirectPath.value })
}

async function goHome() {
  await clearError({ redirect: "/" })
}
</script>

<template>
  <ServerCompatibilityScreen
    v-if="isCompatibilityError"
    status="incompatible"
    :expected-version="expectedVersion"
    :server-version="serverVersion"
    :error="diagnostic"
    :retrying="retrying"
    @retry="retryCompatibility"
  />

  <div v-else class="error-shell">
    <div class="error-panel glass">
      <p class="error-eyebrow">Unhandled error</p>
      <p class="error-code">{{ error.statusCode || 500 }}</p>
      <h1 class="error-title">{{ title }}</h1>
      <p class="error-detail">{{ detail }}</p>

      <div class="error-actions">
        <button class="error-button error-button--primary" type="button" @click="retryGeneric">
          Try again
        </button>
        <button class="error-button" type="button" @click="goHome">
          Go home
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.error-panel {
  width: min(100%, 36rem);
  border-radius: 2rem;
  padding: 2rem;
  display: grid;
  gap: 0.9rem;
}

.error-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(82, 82, 91, 0.85);
}

.error-code {
  margin: 0;
  font-size: clamp(3.4rem, 10vw, 5.2rem);
  line-height: 0.9;
  font-weight: 700;
  letter-spacing: -0.06em;
}

.error-title {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  line-height: 1.05;
}

.error-detail {
  margin: 0;
  color: rgba(63, 63, 70, 0.9);
  line-height: 1.65;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.4rem;
}

.error-button {
  appearance: none;
  border: 1px solid rgba(63, 63, 70, 0.16);
  border-radius: 999px;
  padding: 0.8rem 1.15rem;
  background: rgba(255, 255, 255, 0.6);
  color: rgba(24, 24, 27, 0.95);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.error-button:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.8);
}

.error-button--primary {
  background: rgba(17, 24, 39, 0.94);
  color: white;
  border-color: rgba(17, 24, 39, 0.18);
}

.error-button--primary:hover {
  background: rgba(17, 24, 39, 0.86);
}

:global(.dark) .error-eyebrow {
  color: rgba(228, 228, 231, 0.7);
}

:global(.dark) .error-detail {
  color: rgba(228, 228, 231, 0.8);
}

:global(.dark) .error-button {
  background: rgba(39, 39, 42, 0.82);
  color: rgba(250, 250, 250, 0.96);
  border-color: rgba(255, 255, 255, 0.08);
}

:global(.dark) .error-button:hover {
  background: rgba(63, 63, 70, 0.92);
}

:global(.dark) .error-button--primary {
  background: rgba(244, 244, 245, 0.94);
  color: rgba(17, 24, 39, 0.95);
}

:global(.dark) .error-button--primary:hover {
  background: rgba(244, 244, 245, 0.86);
}
</style>
