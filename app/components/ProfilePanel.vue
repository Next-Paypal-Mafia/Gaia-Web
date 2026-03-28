<script setup lang="ts">
import { useUsage } from '~/composables/useUsage'

const { t, locale, locales, setLocale } = useI18n()

const emit = defineEmits<{
  back: []
}>()

const settings = useSettings()
const usage = useUsage()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const shareLocationModel = computed({
  get: () => settings.shareLocationWithBackend.value,
  set: (v: boolean) => {
    settings.shareLocationWithBackend.value = v
  },
})

const editMode = ref(false)
const editName = ref('')
const saving = ref(false)
const saved = ref(false)

const initials = computed(() => {
  const name = settings.username.value.trim() || 'U'
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
})

const userEmail = ref('')

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    userEmail.value = user.email
  }
})

function startEdit() {
  editName.value = settings.username.value
  editMode.value = true
  saved.value = false
}

function cancelEdit() {
  editMode.value = false
}

function saveProfile() {
  const name = editName.value.trim()
  if (!name) return
  saving.value = true
  settings.username.value = name
  setTimeout(() => {
    saving.value = false
    editMode.value = false
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  }, 300)
}

async function handleLogout() {
  await supabase.auth.signOut()
  window.location.reload()
}
</script>

<template>
  <div class="glass-jelly h-full w-full rounded-2xl flex flex-col ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 shrink-0 border-b border-muted">
      <div class="flex items-center gap-3">
        <button
          class="size-8 rounded-lg bg-default/80 flex items-center justify-center text-muted hover:text-default transition-colors"
          @click="emit('back')"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" />
        </button>
        <div>
          <h1 class="text-lg font-semibold text-default leading-tight">{{ t("profile.title") }}</h1>
          <p class="text-xs text-dimmed">{{ t("profile.subtitle") }}</p>
        </div>
      </div>
      
      <!-- Logout moved to header -->
      <button
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-error bg-error/5 hover:bg-error/10 transition-colors border border-error/20"
        @click="handleLogout"
      >
        <UIcon name="i-lucide-log-out" class="size-3.5" />
        <span>{{ t("profile.log_out") }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
        <!-- Profile hero: full width so shorter tiles are not locked to this row height -->
        <div class="bg-default/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 border border-muted shadow-sm">
          <div
            v-if="settings.profilePicture.value"
            class="size-24 rounded-full shrink-0 overflow-hidden ring-4 ring-muted"
          >
            <img
              :src="settings.profilePicture.value"
              :alt="settings.username.value"
              class="size-full object-cover"
            />
          </div>
          <div
            v-else
            class="size-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-lg"
            style="background: linear-gradient(135deg, var(--ui-color-primary-400), var(--ui-color-primary-600))"
          >
            {{ initials }}
          </div>

          <!-- Identity + appearance as two columns on lg+ -->
          <div class="flex flex-1 flex-col lg:flex-row lg:items-start lg:justify-between gap-5 lg:gap-8 min-w-0 w-full">
            <div class="flex-1 min-w-0 text-center sm:text-left space-y-3 w-full lg:pr-2">
              <div v-if="!editMode">
                <h2 class="text-2xl font-bold text-default wrap-break-word">{{ settings.username.value }}</h2>
                <p v-if="userEmail" class="text-sm text-dimmed truncate">{{ userEmail }}</p>
                <Transition name="fade">
                  <p v-if="saved" class="text-xs text-primary font-medium mt-1">{{ t("profile.saved") }}</p>
                </Transition>
              </div>

              <div v-else class="space-y-3">
                <UInput
                  v-model="editName"
                  :placeholder="t('profile.display_name_placeholder')"
                  class="w-full"
                  size="lg"
                  @keydown.enter="saveProfile"
                />
                <p v-if="userEmail" class="text-xs text-dimmed px-1">{{ t("profile.email_prefix") }} {{ userEmail }}</p>
              </div>

              <div class="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <template v-if="!editMode">
                  <button
                    class="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all"
                    @click="startEdit"
                  >
                    {{ t("profile.edit") }}
                  </button>
                </template>
                <template v-else>
                  <button
                    class="px-4 py-2 rounded-xl text-sm font-medium bg-default/80 text-muted hover:text-default transition-colors"
                    @click="cancelEdit"
                  >
                    {{ t("profile.cancel") }}
                  </button>
                  <button
                    class="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                    :disabled="saving || !editName.trim()"
                    @click="saveProfile"
                  >
                    {{ saving ? t("profile.saving") : t("profile.save") }}
                  </button>
                </template>
              </div>
            </div>

            <!-- Appearance: right column on large screens, full width below on small -->
            <div
              class="w-full lg:w-52 xl:w-56 shrink-0 flex flex-col gap-2 text-center sm:text-left lg:ml-auto lg:pt-0.5"
            >
              <div class="flex items-center justify-center sm:justify-start gap-2">
                <div class="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <UIcon name="i-lucide-palette" class="size-3.5 text-amber-500" />
                </div>
                <p class="text-xs font-bold text-default uppercase tracking-wide">{{ t("profile.appearance") }}</p>
              </div>
              <p class="text-[10px] text-dimmed leading-snug">{{ t("profile.appearance_hint") }}</p>
              <ClientOnly>
                <UColorModeSelect
                  size="sm"
                  variant="outline"
                  color="neutral"
                  :ui="{ base: 'w-full text-xs font-medium rounded-full h-8' }"
                />
              </ClientOnly>
            </div>
          </div>
        </div>

        <!-- Usage: full width (no awkward grid cell beside profile) -->
        <div class="bg-default/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-muted shadow-sm space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="size-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <UIcon name="i-lucide-bar-chart-3" class="size-4 text-blue-500" />
              </div>
              <span class="text-sm font-bold text-default uppercase tracking-wide truncate">{{ t("profile.usage_analytics") }}</span>
            </div>
            <span class="text-[10px] font-black px-2 py-0.5 rounded bg-primary/20 text-primary uppercase shrink-0">
              {{ settings.isLoggedIn.value ? t("profile.pro_tier") : t("profile.free_tier") }}
            </span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-sm gap-2">
                <span class="text-muted font-medium">{{ t("profile.monthly_requests") }}</span>
                <span class="font-bold text-default tabular-nums">{{ usage.requestCount.value }} / {{ usage.limit.value }}</span>
              </div>
              <div class="h-2.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                <div
                  class="h-full bg-primary shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-700 ease-out"
                  :style="{ width: usage.usagePercentage.value + '%' }"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 sm:p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-muted">
                <span class="text-[10px] uppercase font-black text-dimmed block">{{ t("profile.remaining") }}</span>
                <span class="text-xl sm:text-2xl font-bold text-default tabular-nums">{{ usage.remaining.value }}</span>
              </div>
              <div class="p-3 sm:p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-muted">
                <span class="text-[10px] uppercase font-black text-dimmed block">{{ t("profile.monthly_limit") }}</span>
                <span class="text-xl sm:text-2xl font-bold text-default tabular-nums">{{ usage.limit.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Masonry-style packing for compact tiles -->
        <div class="profile-masonry">
          <!-- Subscription -->
          <div class="profile-tile bg-default/40 rounded-2xl sm:rounded-3xl p-4 border border-muted shadow-sm flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <div class="size-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
              </div>
              <span class="text-sm font-bold text-default uppercase tracking-wide">{{ t("profile.subscription") }}</span>
            </div>
            <div>
              <div class="text-base font-bold text-default">{{ t("profile.free_plan") }}</div>
              <p class="text-xs text-dimmed mt-0.5">{{ t("profile.individual_license") }}</p>
            </div>
            <button type="button" class="mt-0 w-full py-2 rounded-xl bg-primary border border-primary/20 text-white text-xs font-bold hover:shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-all">
              {{ t("profile.upgrade_plan") }}
            </button>
          </div>

          <!-- Language (compact pills) -->
          <div class="profile-tile bg-default/40 rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-muted shadow-sm">
            <div class="flex items-center gap-1.5 mb-2">
              <div class="size-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <UIcon name="i-lucide-languages" class="size-3.5 text-indigo-500" />
              </div>
              <span class="text-xs font-bold text-default uppercase tracking-wide">{{ t("profile.language_section") }}</span>
            </div>
            <p class="text-[10px] text-dimmed leading-snug mb-2">{{ t("profile.language_hint") }}</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="l in locales"
                :key="typeof l === 'string' ? l : l.code"
                type="button"
                class="inline-flex items-center gap-1 max-w-full rounded-full text-xs font-semibold transition-all border px-2.5 py-1"
                :class="(typeof l === 'string' ? l : l.code) === locale
                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                  : 'bg-default/60 border-muted text-muted hover:text-default hover:border-muted-foreground/80'"
                @click="setLocale(typeof l === 'string' ? l : l.code)"
              >
                <span class="truncate">{{ typeof l === 'string' ? l : l.name }}</span>
                <UIcon
                  v-if="(typeof l === 'string' ? l : l.code) === locale"
                  name="i-lucide-check"
                  class="size-3 shrink-0 opacity-90"
                />
              </button>
            </div>
          </div>

          <!-- Location -->
          <div v-if="userEmail" class="profile-tile bg-default/40 rounded-2xl sm:rounded-3xl p-4 border border-muted shadow-sm flex flex-col gap-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="size-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <UIcon name="i-lucide-map-pin" class="size-4 text-rose-500" />
                </div>
                <span class="text-sm font-bold text-default uppercase tracking-wide truncate">{{ t("profile.location") }}</span>
              </div>
              <ClientOnly>
                <USwitch v-model="shareLocationModel" size="sm" />
              </ClientOnly>
            </div>
            <p class="text-[11px] text-dimmed leading-relaxed">
              {{ t("profile.location_hint") }}
            </p>
            <div v-if="!config.public.serverUrl" class="pt-0.5">
              <div class="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                <UIcon name="i-lucide-alert-circle" class="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p class="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">{{ t("profile.backend_missing") }}</p>
              </div>
            </div>
          </div>

          <!-- Data -->
          <div class="profile-tile bg-default/40 rounded-2xl sm:rounded-3xl p-4 border border-muted shadow-sm flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <div class="size-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <UIcon name="i-lucide-database" class="size-4 text-emerald-500" />
              </div>
              <span class="text-sm font-bold text-default uppercase tracking-wide">{{ t("profile.data") }}</span>
            </div>
            <p class="text-xs text-dimmed italic leading-snug">{{ t("profile.data_hint") }}</p>
            <button type="button" disabled class="w-full py-2 rounded-xl bg-default/80 text-muted text-xs font-bold opacity-50 cursor-not-allowed">
              {{ t("profile.manage_privacy") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Masonry-style column flow: tiles only as tall as content, minimal vertical gaps */
.profile-masonry {
  column-count: 1;
  column-gap: 0.75rem;
}

@media (min-width: 640px) {
  .profile-masonry {
    column-count: 2;
  }
}

@media (min-width: 1024px) {
  .profile-masonry {
    column-count: 3;
  }
}

.profile-masonry > .profile-tile {
  break-inside: avoid;
  margin-bottom: 0.75rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
