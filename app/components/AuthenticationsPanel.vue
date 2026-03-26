<script setup lang="ts">
import type { SavedCredential } from '~/composables/useAuthentications'
import { credentialFaviconUrl, hostnameLabel, useAuthentications } from '~/composables/useAuthentications'

const settings = useSettings()
const supabase = useSupabaseClient()
const toast = useToast()
const { credentials, syncState, syncError, addCredential, updateCredential, removeCredential } = useAuthentications()

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formUrl = ref('')
const formUsername = ref('')
const formPassword = ref('')
const fetchedPassword = ref('')
const showPassword = ref(false)
const fetchingPassword = ref(false)
const deleteConfirm = ref(false)
/** Favicon load failed per credential id */
const faviconBroken = reactive<Record<string, boolean>>({})

const isEditing = computed(() => editingId.value !== null)

function onFaviconError(id: string) {
  faviconBroken[id] = true
}

function openNew() {
  editingId.value = null
  formName.value = ''
  formUrl.value = ''
  formUsername.value = ''
  formPassword.value = ''
  fetchedPassword.value = ''
  showPassword.value = false
  fetchingPassword.value = false
  deleteConfirm.value = false
  modalOpen.value = true
}

function openEdit(c: SavedCredential) {
  editingId.value = c.id
  formName.value = c.name
  formUrl.value = c.url
  formUsername.value = c.username
  formPassword.value = c.password || ''
  fetchedPassword.value = ''
  showPassword.value = false
  fetchingPassword.value = false
  deleteConfirm.value = false
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  deleteConfirm.value = false
}

function save() {
  const url = formUrl.value.trim()
  const name = formName.value.trim() || hostnameLabel(url)
  if (!url) return

  if (editingId.value) {
    const patch: Partial<SavedCredential> = {
      name,
      url,
      username: formUsername.value.trim(),
    }
    // Only send the password payload if it materially changed, avoiding blind vault replacement churn
    if (formPassword.value && formPassword.value !== fetchedPassword.value) {
      patch.password = formPassword.value
    }
    updateCredential(editingId.value, patch)
  } else {
    addCredential({
      name,
      url,
      username: formUsername.value.trim(),
      password: formPassword.value,
    })
  }
  closeModal()
}

async function togglePassword() {
  if (showPassword.value) {
    showPassword.value = false
    return
  }

  // Show if it's a new unsaved password, or if they explicitly re-typed a pending change
  if (formPassword.value || !editingId.value || !settings.isLoggedIn) {
    showPassword.value = true
    return
  }

  const c = credentials.value.find(x => x.id === editingId.value)
  if (!c || !c.password_secret_id) {
    showPassword.value = true
    return
  }

  fetchingPassword.value = true
  // @ts-ignore - function isn't in generated DB types
  const { data, error } = await (supabase.rpc as any)('get_decrypted_password', { secret_id: c.password_secret_id })
  fetchingPassword.value = false

  if (!error && data) {
    formPassword.value = data
    fetchedPassword.value = data
    showPassword.value = true
  } else {
    toast.add({ title: 'Error', description: 'Could not decrypt password from Vault', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

function requestDelete() {
  deleteConfirm.value = true
}

function confirmDelete() {
  if (editingId.value) {
    removeCredential(editingId.value)
  }
  closeModal()
}

function cancelDelete() {
  deleteConfirm.value = false
}
</script>

<template>
  <div class="glass-jelly flex flex-col h-full w-full rounded-2xl overflow-hidden min-h-0 ring-1 ring-fuchsia-500/10 dark:ring-pink-400/15">
    <!-- Header -->
    <div class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-black/6 dark:border-white/6">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold text-default tracking-tight">Authentications</h1>
        <p class="text-xs text-dimmed mt-0.5">
          <template v-if="settings.isLoggedIn.value">
            Saved logins are securely encrypted and stored in your vault.
          </template>
          <template v-else>
            Sign in to securely vault your web credentials.
          </template>
        </p>
        <p v-if="syncError" class="text-xs text-error mt-1">
          {{ syncError }}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span
          v-if="syncState === 'loading'"
          class="flex items-center gap-1 text-xs text-dimmed"
          title="Loading credentials"
        >
          <UIcon name="i-lucide-loader-2" class="size-3.5 animate-spin" />
        </span>
        <span v-else-if="syncState === 'saving'" class="text-xs text-muted whitespace-nowrap">Saving…</span>
      <UButton
        v-if="settings.isLoggedIn.value"
        icon="i-lucide-plus"
        size="sm"
        @click="openNew"
      >
        Add
      </UButton>
      </div>
    </div>

    <!-- Locked State -->
    <div
      v-if="!settings.isLoggedIn.value"
      class="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center"
    >
      <div class="size-16 rounded-[1.25rem] bg-default/10 flex items-center justify-center mb-5 ring-1 ring-default/20">
        <UIcon name="i-lucide-lock" class="size-7 text-dimmed" />
      </div>
      <h2 class="text-base font-semibold text-default mb-1.5">Account Required</h2>
      <p class="text-sm text-dimmed max-w-sm mb-6">
        Please sign in or create an account to store and manage external credentials. Your passwords are securely encrypted in the vault.
      </p>
    </div>

    <!-- Tiles -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
      <div
        v-if="syncState === 'loading'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-default/20 text-center min-h-28 justify-center animate-pulse"
        >
          <div class="size-12 rounded-xl bg-default/30 shrink-0" />
          <div class="h-4 w-20 bg-default/30 rounded mt-1.5" />
        </div>
      </div>

      <div
        v-else-if="!credentials.length"
        class="flex flex-col items-center justify-center py-16 text-center px-4"
      >
        <div class="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <UIcon name="i-lucide-key-round" class="size-7 text-primary" />
        </div>
        <p class="text-sm font-medium text-default mb-1">No credentials yet</p>
        <p class="text-xs text-dimmed max-w-xs mb-5">
          Add a tile for each website or app. Click a tile to view or edit URL, username, and password.
        </p>
        <UButton size="sm" icon="i-lucide-plus" @click="openNew">
          Add your first login
        </UButton>
      </div>

      <div
        v-else
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        <button
          v-for="c in credentials"
          :key="c.id"
          type="button"
          class="group flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-black/2 dark:bg-white/3 ring-1 ring-black/6 dark:ring-white/6 hover:ring-primary/25 hover:bg-black/4 dark:hover:bg-white/6 transition-all text-center min-h-28 justify-center active:scale-[0.98]"
          @click="openEdit(c)"
        >
          <div class="size-12 rounded-xl bg-elevated flex items-center justify-center overflow-hidden ring-1 ring-default/30 shrink-0">
            <img
              v-if="credentialFaviconUrl(c.url) && !faviconBroken[c.id]"
              :src="credentialFaviconUrl(c.url)!"
              alt=""
              class="size-8 object-contain"
              @error="onFaviconError(c.id)"
            >
            <UIcon
              v-else
              name="i-lucide-globe"
              class="size-7 text-muted"
            />
          </div>
          <span class="text-sm font-medium text-default line-clamp-2 w-full px-0.5">
            {{ c.name }}
          </span>
        </button>

        <button
          type="button"
          class="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-default/40 hover:border-primary/50 hover:bg-primary/5 text-dimmed hover:text-muted transition-all min-h-28 active:scale-[0.98]"
          @click="openNew"
        >
          <UIcon name="i-lucide-plus" class="size-8" />
          <span class="text-xs font-medium">Add login</span>
        </button>
      </div>
    </div>

    <!-- Modal -->
    <UModal
      v-model:open="modalOpen"
      :ui="{
        content: 'max-w-md',
        body: 'p-0 sm:p-0',
        header: 'hidden',
        footer: 'hidden',
      }"
    >
      <template #body>
        <div class="px-5 pt-5 pb-2 border-b border-default/15 shrink-0 flex items-start justify-between gap-2">
          <div>
            <p class="text-base font-semibold text-default">
              {{ deleteConfirm ? 'Remove login?' : (isEditing ? 'Edit login' : 'Add login') }}
            </p>
            <p v-if="!deleteConfirm" class="text-xs text-dimmed mt-1">
              {{ isEditing ? 'Update stored credentials for this site.' : 'Store URL, username, and password for jellybyte to reference.' }}
            </p>
          </div>
           <button
             type="button"
             class="size-9 rounded-full bg-elevated flex items-center justify-center text-default hover:brightness-125 transition-all shrink-0"
             aria-label="Close"
             @click="closeModal"
           >
             <UIcon name="i-lucide-x" class="size-4.5" />
           </button>
        </div>

        <div class="px-5 py-4 max-h-[min(70vh,520px)] overflow-y-auto">
        <div v-if="deleteConfirm" class="space-y-4 py-1">
          <p class="text-sm text-default">
            Remove <span class="font-medium">{{ formName || hostnameLabel(formUrl) }}</span> from saved logins?
          </p>
          <div class="flex gap-2 justify-end">
            <UButton variant="ghost" color="neutral" @click="cancelDelete">
              Cancel
            </UButton>
            <UButton color="error" @click="confirmDelete">
              Delete
            </UButton>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div>
            <label class="text-xs font-medium text-dimmed mb-1.5 block">Display name</label>
            <UInput
              v-model="formName"
              placeholder="e.g. GitHub"
              class="w-full"
            />
            <p class="text-[11px] text-dimmed mt-1">Shown on the tile. Leave blank to use the site hostname.</p>
          </div>
          <div>
            <label class="text-xs font-medium text-dimmed mb-1.5 block">URL</label>
            <UInput
              v-model="formUrl"
              placeholder="https://example.com/login"
              class="w-full"
              type="url"
              autocomplete="off"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-dimmed mb-1.5 block">Username</label>
            <UInput
              v-model="formUsername"
              placeholder="Email or username"
              class="w-full"
              autocomplete="username"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-dimmed mb-1.5 block">Password</label>
            <UInput
              v-model="formPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full"
              autocomplete="current-password"
              :ui="{ trailing: 'pe-1' }"
            >
              <template #trailing>
                <UButton
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  variant="link"
                  color="neutral"
                  size="sm"
                  :loading="fetchingPassword"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="togglePassword"
                />
              </template>
            </UInput>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-2 justify-between">
            <UButton
              v-if="isEditing"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="requestDelete"
            >
              Delete
            </UButton>
            <span v-else />

            <div class="flex gap-2">
              <UButton variant="ghost" color="neutral" @click="closeModal">
                Cancel
              </UButton>
              <UButton :disabled="!formUrl.trim()" @click="save">
                Save
              </UButton>
            </div>
          </div>
        </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
