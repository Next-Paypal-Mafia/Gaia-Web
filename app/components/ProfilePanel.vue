<script setup lang="ts">
const emit = defineEmits<{
  back: []
}>()

const settings = useSettings()
const supabase = useSupabaseClient()

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
  settings.isLoggedIn.value = false
  settings.username.value = 'User'
  settings.profilePicture.value = ''
  emit('back')
}
</script>

<template>
  <div class="h-full w-full rounded-2xl bg-elevated flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-5 shrink-0 border-b border-muted">
      <button
        class="size-8 rounded-lg bg-default/80 flex items-center justify-center text-muted hover:text-default transition-colors"
        @click="emit('back')"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" />
      </button>
      <div>
        <h1 class="text-lg font-semibold text-default leading-tight">Profile</h1>
        <p class="text-xs text-dimmed">Manage your account and settings</p>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-lg mx-auto px-6 py-6 space-y-6">
        <!-- Profile card -->
        <div class="bg-default/50 rounded-2xl p-6 flex flex-col items-center gap-4">
          <div
            v-if="settings.profilePicture.value"
            class="size-20 rounded-full shrink-0 overflow-hidden ring-2 ring-muted"
          >
            <img
              :src="settings.profilePicture.value"
              :alt="settings.username.value"
              class="size-full object-cover"
            />
          </div>
          <div
            v-else
            class="size-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0"
            style="background: linear-gradient(135deg, var(--ui-color-primary-400), var(--ui-color-primary-600))"
          >
            {{ initials }}
          </div>

          <!-- View mode -->
          <div v-if="!editMode" class="text-center space-y-1">
            <h2 class="text-xl font-semibold text-default">{{ settings.username.value }}</h2>
            <p v-if="userEmail" class="text-sm text-dimmed">{{ userEmail }}</p>
            <Transition name="fade">
              <p v-if="saved" class="text-xs text-primary font-medium">Profile saved.</p>
            </Transition>
          </div>

          <!-- Edit mode -->
          <div v-else class="w-full max-w-xs space-y-3">
            <div>
              <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Display name</label>
              <UInput
                v-model="editName"
                placeholder="Your name"
                class="w-full"
                @keydown.enter="saveProfile"
              />
            </div>
            <div v-if="userEmail">
              <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Email</label>
              <p class="text-sm text-muted px-1">{{ userEmail }}</p>
              <p class="text-[11px] text-dimmed px-1 mt-0.5">Managed by your sign-in provider.</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 mt-1">
            <template v-if="!editMode">
              <button
                class="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
                @click="startEdit"
              >
                Edit profile
              </button>
            </template>
            <template v-else>
              <button
                class="px-4 py-1.5 rounded-lg text-sm font-medium bg-default/80 text-muted hover:text-default transition-colors"
                @click="cancelEdit"
              >
                Cancel
              </button>
              <button
                class="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                :disabled="saving || !editName.trim()"
                @click="saveProfile"
              >
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </template>
          </div>
        </div>

        <!-- Account settings -->
        <div class="space-y-3">
          <h2 class="text-sm font-semibold text-default px-1">Account settings</h2>

          <div class="bg-default/50 rounded-2xl overflow-hidden divide-y divide-muted">
            <!-- Subscription -->
            <div class="flex items-center justify-between px-4 py-3.5">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-sparkles" class="size-4 text-muted shrink-0" />
                <span class="text-sm text-default">Subscription</span>
              </div>
              <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">Free plan</span>
            </div>

            <!-- Appearance -->
            <div class="flex items-center justify-between px-4 py-3.5">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-moon" class="size-4 text-muted shrink-0" />
                <span class="text-sm text-default">Appearance</span>
              </div>
              <span class="text-sm text-dimmed">System</span>
            </div>

            <!-- Data -->
            <div class="flex items-center justify-between px-4 py-3.5">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-database" class="size-4 text-muted shrink-0" />
                <span class="text-sm text-default">Data controls</span>
              </div>
              <span class="text-xs text-dimmed">Coming soon</span>
            </div>
          </div>
        </div>

        <!-- Logout -->
        <button
          class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-default/50 text-sm font-medium text-error hover:bg-error/10 transition-colors"
          @click="handleLogout"
        >
          <UIcon name="i-lucide-log-out" class="size-4" />
          Log out
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
