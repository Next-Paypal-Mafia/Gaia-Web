<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  /** When false (icon rail), show header control to expand the full sidebar */
  sidebarExpanded?: boolean
}>()

const emit = defineEmits<{
  showSidebar: []
}>()

type ViewMode = 'icon' | 'list'
const viewMode = ref<ViewMode>('icon')
const searchQuery = ref('')
const searchFocused = ref(false)

// Mock vault files - in a real app these would come from an API/store
const vaultFiles = ref([
  { id: '1', name: 'Screenshot 2026-03-12.png', type: 'image', icon: 'i-lucide-image' },
  { id: '2', name: 'logo_ascii.png', type: 'image', icon: 'i-lucide-image' },
  { id: '3', name: 'Tuesday Social Session.ics', type: 'calendar', icon: 'i-lucide-calendar' },
  { id: '4', name: 'openapi.yaml', type: 'document', icon: 'i-lucide-file-code' },
  { id: '5', name: 'output.mp4', type: 'video', icon: 'i-lucide-video' },
  { id: '6', name: 'Untitled Project.JPG', type: 'image', icon: 'i-lucide-image' },
  { id: '7', name: 'README.md', type: 'document', icon: 'i-lucide-file-text' },
  { id: '8', name: 'requirements.txt', type: 'document', icon: 'i-lucide-file-code' },
  { id: '9', name: 'ca.key', type: 'key', icon: 'i-lucide-key' },
  { id: '10', name: 'client.key', type: 'key', icon: 'i-lucide-key' },
  { id: '11', name: 'add_if_then_else.h', type: 'document', icon: 'i-lucide-file-code' },
  { id: '12', name: 'Docker.dmg', type: 'archive', icon: 'i-lucide-archive' },
  { id: '13', name: 'Bumblebee (2018).mkv', type: 'video', icon: 'i-lucide-video' },
  { id: '14', name: 'out.mp4', type: 'video', icon: 'i-lucide-video' },
])

function fuzzyMatch(text: string, query: string): boolean {
  if (!query.trim()) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase().trim()
  let ti = 0
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q.charAt(qi), ti)
    if (idx === -1) return false
    ti = idx + 1
  }
  return true
}

const filteredFiles = computed(() => {
  const term = searchQuery.value
  if (!term.trim()) return vaultFiles.value
  return vaultFiles.value.filter((f) => fuzzyMatch(f.name, term))
})
</script>

<template>
  <LiquidGlassPanel class="relative">
    <div class="flex flex-col h-full min-h-0 w-full relative">
    <!-- Coming Soon Overlay -->
    <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-black/60 backdrop-blur-md p-6 text-center">
      <div class="size-16 rounded-[1.25rem] bg-primary/10 flex items-center justify-center mb-5 ring-1 ring-primary/20">
        <UIcon name="i-lucide-archive" class="size-8 text-primary" />
      </div>
      <h2 class="text-xl font-semibold text-default mb-2">Vault Coming Soon</h2>
      <p class="text-sm text-dimmed max-w-sm mb-6">
        We're building a secure, end-to-end encrypted vault to store your agent's confidential files, API keys, and documents.
      </p>
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
        <UIcon name="i-lucide-rocket" class="size-3.5" />
        In Development
      </div>
    </div>

    <!-- Original Content (Disabled state) -->
    <div class="flex flex-col h-full w-full opacity-40 pointer-events-none select-none">
      <!-- Toolbar: jellybyte logo (when sidebar hidden) + search on left, view selector + add + filter on right -->
      <div class="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
      <!-- jellybyte logo + text - shown when sidebar is hidden, click to show sidebar -->
      <button
        v-if="sidebarExpanded === false"
        class="flex items-center gap-2 px-4 py-2 shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
        @click="emit('showSidebar')"
      >
        <UIcon name="i-lucide-earth" class="size-5 text-primary" />
        <span class="font-bold text-sm tracking-tight">jellybyte</span>
      </button>

      <!-- Search - fills remaining space on left -->
      <div
        class="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-default/60 ring-1 ring-[var(--ui-border-muted)] transition-colors"
        :class="searchFocused ? 'ring-white/30 bg-default/80' : ''"
      >
        <UIcon name="i-lucide-search" class="size-4 text-muted shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search files..."
          class="flex-1 min-w-0 bg-transparent text-sm text-default placeholder:text-muted outline-none"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        >
      </div>

      <!-- View selector + add + filter on top right -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- View toggle (icon vs list) -->
        <div class="flex rounded-2xl bg-default/60 overflow-hidden ring-1 ring-[var(--ui-border-muted)]">
          <button
            class="flex items-center justify-center size-9 transition-colors"
            :class="viewMode === 'icon' ? 'bg-elevated text-default ring-1 ring-white/20' : 'text-muted hover:text-default hover:bg-default/40'"
            aria-label="Icon view"
            @click="viewMode = 'icon'"
          >
            <UIcon name="i-lucide-layout-grid" class="size-4" />
          </button>
          <button
            class="flex items-center justify-center size-9 transition-colors"
            :class="viewMode === 'list' ? 'bg-elevated text-default ring-1 ring-white/20' : 'text-muted hover:text-default hover:bg-default/40'"
            aria-label="List view"
            @click="viewMode = 'list'"
          >
            <UIcon name="i-lucide-list" class="size-4" />
          </button>
        </div>

        <!-- Add button -->
        <button
          class="flex items-center justify-center size-9 rounded-2xl bg-default/60 ring-1 ring-[var(--ui-border-muted)] text-muted hover:text-default hover:bg-default/80 transition-colors"
          aria-label="Add"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
        </button>

        <!-- Filter button -->
        <UDropdownMenu
          :items="[
            { label: 'All files', icon: 'i-lucide-file' },
            { type: 'separator' },
            { label: 'Images', icon: 'i-lucide-image' },
            { label: 'Documents', icon: 'i-lucide-file-text' },
            { label: 'Videos', icon: 'i-lucide-video' },
          ]"
          :content="{ align: 'end', side: 'bottom' }"
        >
          <button
            class="flex items-center justify-center h-9 min-w-9 gap-1 px-2.5 rounded-2xl bg-default/60 ring-1 ring-[var(--ui-border-muted)] text-muted hover:text-default hover:bg-default/80 transition-colors"
            aria-label="Filter files"
          >
            <UIcon name="i-lucide-sliders-horizontal" class="size-4" />
            <UIcon name="i-lucide-chevron-down" class="size-3.5" />
          </button>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Scrollable file area -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
      <!-- Icon view - grid like Mac Finder, sized for ~3 rows visible -->
      <div
        v-if="viewMode === 'icon'"
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(88px, 1fr))"
      >
        <button
          v-for="file in filteredFiles"
          :key="file.id"
          class="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-default/60 transition-colors text-left group"
        >
          <div
            class="size-11 rounded-lg flex items-center justify-center bg-default/40 group-hover:bg-default/60 transition-colors shrink-0"
          >
            <UIcon :name="file.icon" class="size-5 text-muted" />
          </div>
          <span
            class="text-[11px] text-default text-center line-clamp-2 break-words w-full px-0.5 leading-tight"
          >
            {{ file.name }}
          </span>
        </button>
      </div>

      <!-- List view - rows like Mac Finder list -->
      <div
        v-else
        class="flex flex-col divide-y divide-[var(--ui-border-muted)] rounded-xl bg-default/30"
      >
        <button
          v-for="file in filteredFiles"
          :key="file.id"
          class="flex items-center gap-3 px-4 py-2.5 hover:bg-default/60 transition-colors text-left w-full"
        >
          <div
            class="size-9 rounded-lg flex items-center justify-center bg-default/60 shrink-0"
          >
            <UIcon :name="file.icon" class="size-4 text-muted" />
          </div>
          <span class="text-sm text-default truncate flex-1 min-w-0">
            {{ file.name }}
          </span>
          <span class="text-xs text-dimmed shrink-0 capitalize">
            {{ file.type }}
          </span>
        </button>
      </div>

      <p
        v-if="filteredFiles.length === 0"
        class="py-8 text-center text-sm text-dimmed"
      >
        No files match your search.
      </p>
    </div>
    </div>
    </div>
  </LiquidGlassPanel>
</template>
