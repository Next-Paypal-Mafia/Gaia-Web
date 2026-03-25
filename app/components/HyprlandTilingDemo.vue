<script setup lang="ts">
/**
 * Hyprland-inspired dynamic tiling demo (web approximation).
 * Easing references Hyprland-style overshot / smoothOut curves.
 * @see https://github.com/hyprwm/Hyprland
 */

export interface TilingWindow {
  id: string
  label: string
  color: string
}

interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

const OVERSHOT = 'cubic-bezier(0.05, 0.9, 0.1, 1.1)'
const SMOOTH_OUT = 'cubic-bezier(0.36, 0, 0.66, -0.56)'

const windows = ref<TilingWindow[]>([])
const rects = ref<Map<string, NormRect>>(new Map())
const focusedId = ref<string | null>(null)

const pastelPool = [
  'bg-rose-200/90 dark:bg-rose-900/50',
  'bg-amber-200/90 dark:bg-amber-900/50',
  'bg-emerald-200/90 dark:bg-emerald-900/50',
  'bg-sky-200/90 dark:bg-sky-900/50',
  'bg-teal-200/90 dark:bg-cyan-950/50',
  'bg-cyan-200/90 dark:bg-cyan-900/50',
  'bg-teal-200/90 dark:bg-cyan-900/50',
  'bg-lime-200/90 dark:bg-lime-900/50',
]

function randomPastel(): string {
  return pastelPool[Math.floor(Math.random() * pastelPool.length)] ?? 'bg-stone-200/90'
}

function rebuildRects(ids: string[]) {
  const next = new Map<string, NormRect>()
  if (ids.length === 0) {
    rects.value = next
    return
  }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    if (i === 0) {
      next.set(id, { x: 0, y: 0, w: 1, h: 1 })
      continue
    }
    const victim = ids[i - 1]!
    const r = next.get(victim)
    if (!r) continue
    const k = i + 1
    const splitHorizontal = k % 2 === 0
    if (splitHorizontal) {
      next.set(victim, { x: r.x, y: r.y, w: r.w / 2, h: r.h })
      next.set(id, { x: r.x + r.w / 2, y: r.y, w: r.w / 2, h: r.h })
    } else {
      next.set(victim, { x: r.x, y: r.y, w: r.w, h: r.h / 2 })
      next.set(id, { x: r.x, y: r.y + r.h / 2, w: r.w, h: r.h / 2 })
    }
  }
  rects.value = next
}

function tileStyle(id: string): Record<string, string> {
  const r = rects.value.get(id)
  if (!r) return { display: 'none' }
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  }
}

function addWindow() {
  const id = `win-${crypto.randomUUID?.() ?? String(Date.now())}`
  const n = windows.value.length + 1
  windows.value = [
    ...windows.value,
    {
      id,
      label: `Window ${n}`,
      color: randomPastel(),
    },
  ]
  rebuildRects(windows.value.map(w => w.id))
  focusedId.value = id
}

function addRandomWindows() {
  const count = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) addWindow()
}

function removeWindow(id: string) {
  windows.value = windows.value.filter(w => w.id !== id)
  rebuildRects(windows.value.map(w => w.id))
  if (focusedId.value === id) {
    focusedId.value = windows.value[windows.value.length - 1]?.id ?? null
  }
}

function focusWindow(id: string) {
  focusedId.value = id
}

onMounted(() => {
  addWindow()
})
</script>

<template>
  <div class="flex flex-col h-full min-h-[480px] w-full max-w-6xl mx-auto rounded-xl bg-default/30 ring-1 ring-default/40 overflow-hidden">
    <!-- Toolbar -->
    <div class="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-default/30 bg-elevated/80">
      <span class="text-sm font-semibold text-default mr-2">Hyprland-style tiling</span>
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-transform"
        @click="addWindow"
      >
        Add window
      </button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg bg-default/80 text-default text-xs font-medium ring-1 ring-default/50 hover:bg-default active:scale-[0.98] transition-transform"
        @click="addRandomWindows"
      >
        Spawn random batch
      </button>
      <span class="text-[11px] text-dimmed ml-auto">
        {{ windows.length }} tile(s) · focused: {{ focusedId?.slice(0, 8) ?? '—' }}
      </span>
    </div>

    <!-- Tiling surface -->
    <div class="relative flex-1 min-h-0 p-2 sm:p-3">
      <TransitionGroup
        name="hypr"
        tag="div"
        class="relative w-full h-full min-h-[400px]"
      >
        <div
          v-for="w in windows"
          :key="w.id"
          class="hypr-window-tile absolute min-w-0 min-h-0 p-1"
          :class="[
            focusedId === w.id ? 'hypr-window-tile--focused z-10' : 'z-0',
          ]"
          :style="tileStyle(w.id)"
          @click.self="focusWindow(w.id)"
        >
          <!-- Animated border shell (borderangle-style) -->
          <div
            class="hypr-border-shell h-full w-full rounded-lg drop-shadow-xl"
            :class="focusedId === w.id ? 'hypr-border-shell--active' : 'hypr-border-shell--inactive'"
            @click="focusWindow(w.id)"
          >
            <div
              class="hypr-border-inner flex flex-col h-full rounded-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
              :class="w.color"
            >
              <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-black/10 dark:bg-black/25">
                <span class="text-xs font-semibold text-default/90 truncate">{{ w.label }}</span>
                <button
                  type="button"
                  class="size-7 rounded-md flex items-center justify-center hover:bg-black/15 dark:hover:bg-white/10 text-default/80"
                  aria-label="Close window"
                  @click.stop="removeWindow(w.id)"
                >
                  <span class="text-lg leading-none">×</span>
                </button>
              </div>
              <div class="flex-1 min-h-0 p-3 text-xs text-default/70 flex items-center justify-center">
                <p class="text-center max-w-[200px]">
                  Dwindle split · pop-in / smooth-out · FLIP move
                </p>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div
        v-if="windows.length === 0"
        class="absolute inset-0 flex items-center justify-center text-sm text-dimmed"
      >
        No windows — click “Add window”
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Hyprland-style easing (exact requested curves) ─────────────────── */
:root {
  --hypr-overshot: cubic-bezier(0.05, 0.9, 0.1, 1.1);
  --hypr-smooth-out: cubic-bezier(0.36, 0, 0.66, -0.56);
}

/* Layout reflow: windows slide/resize when siblings add/remove (dwindle geometry) */
.hypr-window-tile {
  transition:
    left 400ms var(--hypr-overshot),
    top 400ms var(--hypr-overshot),
    width 400ms var(--hypr-overshot),
    height 400ms var(--hypr-overshot);
}

/* ── TransitionGroup: windowsIn (popin 80%) ─────────────────────────── */
.hypr-enter-active {
  transition:
    transform 400ms var(--hypr-overshot),
    opacity 400ms var(--hypr-overshot);
}
.hypr-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.hypr-enter-to {
  opacity: 1;
  transform: scale(1);
}

/* ── TransitionGroup: windowsOut ──────────────────────────────────────── */
.hypr-leave-active {
  transition:
    transform 300ms var(--hypr-smooth-out),
    opacity 300ms var(--hypr-smooth-out);
  position: absolute !important;
}
.hypr-leave-from {
  opacity: 1;
  transform: scale(1);
}
.hypr-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

/* ── TransitionGroup: windowsMove (FLIP) ──────────────────────────────── */
.hypr-move {
  transition: transform 400ms var(--hypr-overshot);
}

/* ── borderangle: rotating conic border for focused window ────────────── */
.hypr-border-shell {
  border-radius: 0.5rem;
  padding: 2px;
  background: transparent;
  box-sizing: border-box;
}

.hypr-border-shell--inactive {
  background: color-mix(in oklab, var(--ui-color-neutral-400, #a8a29e) 35%, transparent);
}

/* Active: rotating conic-gradient ring (Hyprland borderangle-style) */
.hypr-border-shell--active {
  position: relative;
  background: transparent;
  isolation: isolate;
  overflow: hidden;
}

.hypr-border-shell--active::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  z-index: 0;
  background: conic-gradient(
    from 0deg,
    #34d399,
    #22d3ee,
    #818cf8,
    #f472b6,
    #a78bfa,
    #34d399
  );
  animation: hypr-border-rotate 10s linear infinite;
}

.hypr-border-shell--active .hypr-border-inner {
  position: relative;
  z-index: 1;
}

@keyframes hypr-border-rotate {
  to {
    transform: rotate(360deg);
  }
}

.hypr-border-inner {
  border-radius: calc(0.5rem - 2px);
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .hypr-window-tile {
    transition-duration: 0.01ms !important;
  }
  .hypr-enter-active,
  .hypr-leave-active,
  .hypr-move {
    transition-duration: 0.01ms !important;
  }
  .hypr-border-shell--active {
    animation: none !important;
  }
}
</style>
