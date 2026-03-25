<script setup lang="ts">
import { computed } from "vue";

/** Shared liquid settings: landing hero + all major floating surfaces use the same recipe. */
const LIQUID_SHARED = {
  blur: 8,
  brightness: 74,
  opacity: 0.9,
  backgroundOpacity: 0,
  displace: 0.42,
  distortionScale: -158,
  mixBlendMode: "soft-light" as const,
  saturation: 1.2,
};

const props = withDefaults(
  defineProps<{
    variant?: "panel" | "hero" | "sidebar";
    /** Stronger ring (e.g. expanded sidebar over live browser). */
    emphasized?: boolean;
    /**
     * Sidebar only: extra frosted tint when the live browser sits behind the rail (bright pages).
     * Off on dashboard / vault / etc. so the bar matches other glass panels.
     */
    brightBackdrop?: boolean;
  }>(),
  { variant: "panel", emphasized: false, brightBackdrop: false },
);

const liquidBindings = computed(() => {
  if (props.variant === "hero") {
    return {
      ...LIQUID_SHARED,
      borderRadius: 28,
      width: "100%",
      height: "auto",
    };
  }
  if (props.variant === "sidebar") {
    const overBrowser = props.brightBackdrop;
    return {
      ...LIQUID_SHARED,
      borderRadius: 16,
      width: "100%",
      height: "100%",
      ...(overBrowser
        ? {
            backgroundOpacity: 0.58,
            blur: 14,
            brightness: 58,
            opacity: 0.94,
          }
        : {}),
    };
  }
  return {
    ...LIQUID_SHARED,
    borderRadius: 16,
    width: "100%",
    height: "100%",
  };
});

const shellClass = computed(() => {
  if (props.variant === "hero") {
    return "w-full max-w-2xl mx-auto landing-liquid-glass glass-panel--elevated";
  }
  const ring = props.emphasized
    ? "ring-teal-500/20 dark:ring-cyan-400/32"
    : "ring-teal-500/12 dark:ring-cyan-400/22";
  return `min-h-0 h-full w-full rounded-2xl overflow-hidden glass-panel--elevated ring-1 ${ring}`;
});

const tintChrome = computed(() => (props.variant === "sidebar" ? "oceanRail" : "none"));
</script>

<template>
  <LiquidGlass
    v-bind="liquidBindings"
    content-layout="fill"
    :tint-chrome="tintChrome"
    :class="shellClass"
  >
    <slot />
  </LiquidGlass>
</template>
