<script setup lang="ts">
const props = withDefaults(defineProps<{
  status: "checking" | "incompatible"
  expectedVersion: string
  serverVersion?: string | null
  error?: string | null
  retrying?: boolean
}>(), {
  serverVersion: null,
  error: null,
  retrying: false,
})

const emit = defineEmits<{
  retry: []
}>()

const title = computed(() =>
  props.status === "checking"
    ? "Checking server compatibility"
    : "Upgrade required",
)

const description = computed(() =>
  props.status === "checking"
    ? "Jellybyte is verifying that this web client and backend speak the same API version before anything else starts."
    : "This backend reports a different API version, so the web client stays locked until the versions match.",
)

const statusCode = computed(() =>
  props.status === "checking" ? "SYNC" : "426",
)
</script>

<template>
  <div class="compat-screen">
    <div class="compat-panel glass">
      <div class="compat-panel__hero">
        <p class="compat-panel__eyebrow">
          {{ props.status === "checking" ? "Startup guard" : "Compatibility guard" }}
        </p>
        <div class="compat-panel__code" :class="{ 'compat-panel__code--checking': props.status === 'checking' }">
          <UIcon v-if="props.status === 'checking'" name="i-lucide-loader-circle" class="size-11 animate-spin text-primary" />
          <span v-else>{{ statusCode }}</span>
        </div>
        <h1 class="compat-panel__title">{{ title }}</h1>
        <p class="compat-panel__description">{{ description }}</p>
      </div>

      <div class="compat-panel__details">
        <div class="compat-metric">
          <span class="compat-metric__label">Client expects</span>
          <span class="compat-metric__value">{{ expectedVersion }}</span>
        </div>
        <div class="compat-metric">
          <span class="compat-metric__label">Server reports</span>
          <span class="compat-metric__value">{{ serverVersion || "unknown" }}</span>
        </div>

        <p v-if="props.status === 'incompatible'" class="compat-panel__hint">
          Update the web client or switch this app to a backend running the expected API version, then retry.
        </p>
        <p v-else class="compat-panel__hint">
          The app stays paused during this handshake so it does not boot into a broken state.
        </p>

        <p v-if="error" class="compat-panel__diagnostic">
          Diagnostic: {{ error }}
        </p>

        <div v-if="props.status === 'incompatible'" class="compat-panel__actions">
          <UButton color="warning" icon="i-lucide-refresh-cw" :loading="retrying" :disabled="retrying" @click="emit('retry')">
            Retry compatibility check
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compat-screen {
  position: relative;
  z-index: 10;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.compat-panel {
  width: min(100%, 940px);
  border-radius: 2rem;
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
  background:
    radial-gradient(circle at top left, rgba(244, 114, 182, 0.16), transparent 40%),
    radial-gradient(circle at bottom right, rgba(167, 139, 250, 0.14), transparent 42%),
    rgba(255, 255, 255, 0.58);
}

:global(.dark) .compat-panel {
  background:
    radial-gradient(circle at top left, rgba(244, 114, 182, 0.14), transparent 38%),
    radial-gradient(circle at bottom right, rgba(167, 139, 250, 0.12), transparent 40%),
    rgba(17, 24, 39, 0.6);
}

.compat-panel__hero,
.compat-panel__details {
  position: relative;
  overflow: hidden;
  border-radius: 1.5rem;
  padding: 1.5rem;
}

.compat-panel__hero {
  background: linear-gradient(140deg, rgba(17, 24, 39, 0.94), rgba(88, 28, 135, 0.9));
  color: white;
}

.compat-panel__details {
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.42);
  display: grid;
  gap: 0.9rem;
}

:global(.dark) .compat-panel__details {
  background: rgba(24, 24, 27, 0.58);
  border-color: rgba(255, 255, 255, 0.08);
}

.compat-panel__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}

.compat-panel__code {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: clamp(3.5rem, 9vw, 6rem);
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 0.92;
}

.compat-panel__code--checking {
  font-size: 1rem;
  letter-spacing: 0;
}

.compat-panel__title {
  margin: 1rem 0 0;
  font-size: clamp(1.75rem, 4vw, 2.7rem);
  font-weight: 600;
  line-height: 1.02;
}

.compat-panel__description,
.compat-panel__hint,
.compat-panel__diagnostic {
  margin: 0;
  line-height: 1.6;
}

.compat-panel__description {
  margin-top: 0.8rem;
  max-width: 36rem;
  color: rgba(255, 255, 255, 0.78);
}

.compat-metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.48);
}

:global(.dark) .compat-metric {
  background: rgba(255, 255, 255, 0.04);
}

.compat-metric__label {
  font-size: 0.82rem;
  color: rgba(63, 63, 70, 0.9);
}

:global(.dark) .compat-metric__label {
  color: rgba(228, 228, 231, 0.7);
}

.compat-metric__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.94rem;
  font-weight: 600;
  color: rgba(17, 24, 39, 0.96);
}

:global(.dark) .compat-metric__value {
  color: rgba(244, 244, 245, 0.95);
}

.compat-panel__hint {
  color: rgba(39, 39, 42, 0.82);
}

:global(.dark) .compat-panel__hint {
  color: rgba(228, 228, 231, 0.78);
}

.compat-panel__diagnostic {
  font-size: 0.88rem;
  color: rgb(161, 98, 7);
}

:global(.dark) .compat-panel__diagnostic {
  color: rgb(253, 224, 71);
}

.compat-panel__actions {
  padding-top: 0.25rem;
}

@media (min-width: 900px) {
  .compat-panel {
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    align-items: stretch;
    padding: 1.75rem;
  }

  .compat-panel__hero,
  .compat-panel__details {
    padding: 1.75rem;
  }
}
</style>
