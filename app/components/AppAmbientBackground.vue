<script setup lang="ts">
/**
 * Full-viewport WebGL aurora + static fallback (reduced motion / no WebGL).
 * Tuned for ocean palette; pairs with .ocean-page-bg on the app shell.
 */
const colorMode = useColorMode()

const auroraStops = computed(() => {
  if (colorMode.value === "dark")
    return ["#020617", "#0e7490", "#22d3ee"]
  return ["#38bdf8", "#a5f3fc", "#2dd4bf"]
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    aria-hidden="true"
  >
    <div class="ambient-static absolute inset-0 bg-gradient-to-br from-sky-200/95 via-teal-100 to-cyan-200/90 dark:from-slate-950 dark:via-cyan-950/40 dark:to-slate-900" />
    <ClientOnly>
      <div class="ambient-aurora absolute inset-0 opacity-[0.4] dark:opacity-[0.46] mix-blend-soft-light dark:mix-blend-plus-lighter">
        <AuroraBackground
          :color-stops="auroraStops"
          :amplitude="0.5"
          :blend="0.42"
          :intensity="0.62"
          :speed="0.48"
        />
      </div>
    </ClientOnly>
    <div
      class="ambient-vignette absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,transparent_38%,rgba(15,118,110,0.1)_100%)] dark:bg-[radial-gradient(ellipse_85%_65%_at_50%_-5%,transparent_35%,rgba(2,8,20,0.55)_100%)]"
    />
  </div>
</template>

<style scoped>
.ambient-static {
  display: none;
}

.ambient-aurora,
.ambient-vignette {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .ambient-static {
    display: block;
  }

  .ambient-aurora {
    display: none;
  }

  .ambient-vignette {
    display: none;
  }
}
</style>
