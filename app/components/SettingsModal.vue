<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const settings = useSettings()

type Page = 'main' | 'login' | 'signup'
const currentPage = ref<Page>('main')

const loginEmail = ref('')
const loginPassword = ref('')
const loginShowPassword = ref(false)
const loginLoading = ref(false)

const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirmPassword = ref('')
const signupShowPassword = ref(false)
const signupLoading = ref(false)

const initials = computed(() => {
  const name = settings.username.value.trim() || 'U'
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
})

watch(open, async (val) => {
  if (val) {
    const supabase = useSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const meta = user.user_metadata || {}
      settings.username.value = (meta.full_name as string) || (meta.name as string) || (meta.given_name as string) || user.email?.split('@')[0] || 'User'
      settings.profilePicture.value = (meta.avatar_url as string) || (meta.picture as string) || ''
      settings.isLoggedIn.value = true
    }
  } else {
    setTimeout(() => {
      currentPage.value = 'main'
      resetAuthForms()
    }, 250)
  }
})

function resetAuthForms() {
  loginEmail.value = ''
  loginPassword.value = ''
  loginShowPassword.value = false
  loginLoading.value = false
  signupEmail.value = ''
  signupPassword.value = ''
  signupConfirmPassword.value = ''
  signupShowPassword.value = false
  signupLoading.value = false
}

function openLogin() {
  resetAuthForms()
  currentPage.value = 'login'
}

function openSignup() {
  resetAuthForms()
  currentPage.value = 'signup'
}

function handleLogin() {
  if (!loginEmail.value.trim() || !loginPassword.value) return
  loginLoading.value = true
  setTimeout(() => {
    settings.isLoggedIn.value = true
    if (loginEmail.value.includes('@')) {
      settings.username.value = loginEmail.value.split('@')[0]
    }
    loginLoading.value = false
    currentPage.value = 'main'
    resetAuthForms()
  }, 600)
}

async function handleGoogleLogin() {
  const supabase = useSupabaseClient()
  loginLoading.value = true
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
    currentPage.value = 'main'
    resetAuthForms()
  } catch (e: any) {
    const toast = useToast()
    toast.add({
      title: 'Sign in failed',
      description: e?.message || 'Could not sign in with Google',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    loginLoading.value = false
  }
}

function handleSignup() {
  if (!signupEmail.value.trim() || !signupPassword.value || signupPassword.value !== signupConfirmPassword.value) return
  signupLoading.value = true
  setTimeout(() => {
    settings.isLoggedIn.value = true
    if (signupEmail.value.includes('@')) {
      settings.username.value = signupEmail.value.split('@')[0]
    }
    signupLoading.value = false
    currentPage.value = 'main'
    resetAuthForms()
  }, 600)
}

async function handleLogout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  settings.isLoggedIn.value = false
  settings.username.value = 'User'
  settings.profilePicture.value = ''
}
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      content: 'max-w-[380px] overflow-hidden',
      body: 'p-0 sm:p-0',
      header: 'hidden',
      footer: 'hidden',
    }"
  >
    <template #body>
      <!-- Page wrapper with slide transition -->
      <div class="relative overflow-hidden">
        <!-- MAIN PAGE -->
        <Transition name="slide-left">
          <div v-if="currentPage === 'main'" class="flex flex-col max-h-[80vh] overflow-y-auto">
            <!-- Header: centered title + circular X -->
            <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
              <div class="size-9" />
              <span class="font-bold text-base text-default">Settings</span>
              <button
                class="size-9 rounded-full bg-elevated flex items-center justify-center text-default hover:brightness-125 transition-all"
                @click="open = false"
              >
                <UIcon name="i-lucide-x" class="size-[18px]" />
              </button>
            </div>

            <!-- Profile section -->
            <div class="flex flex-col items-center px-6 pb-6 pt-1 shrink-0">
              <div
                v-if="settings.profilePicture.value"
                class="size-[72px] rounded-full mb-3 shrink-0 overflow-hidden ring-2 ring-[var(--ui-border-muted)]"
              >
                <img
                  :src="settings.profilePicture.value"
                  :alt="settings.username.value"
                  class="size-full object-cover"
                />
              </div>
              <div
                v-else
                class="size-[72px] rounded-full flex items-center justify-center mb-3 text-white font-bold text-2xl shrink-0"
                style="background: linear-gradient(135deg, var(--ui-color-primary-400), var(--ui-color-primary-600))"
              >
                {{ initials }}
              </div>
              <h2 class="text-xl font-semibold text-default">{{ settings.username.value }}</h2>
              <span class="text-xs text-dimmed mt-0.5">Free plan</span>
              <button
                v-if="!settings.isLoggedIn.value"
                class="mt-3 px-5 py-1.5 rounded-full bg-[var(--ui-color-primary-500)] text-white text-sm font-medium hover:bg-[var(--ui-color-primary-600)] transition-colors"
                @click="openLogin"
              >
                Log in
              </button>
              <button
                v-else
                class="mt-3 px-5 py-1.5 rounded-full bg-elevated text-sm font-medium text-muted hover:brightness-125 transition-colors"
                @click="handleLogout"
              >
                Log out
              </button>
            </div>

            <!-- Account section -->
            <div class="px-4 pb-6 space-y-4">
              <div>
                <p class="text-xs font-medium text-dimmed px-1 mb-1.5 uppercase tracking-wide">Account</p>
                <div class="bg-elevated rounded-xl overflow-hidden divide-y divide-[var(--ui-border-muted)]">
                  <!-- Username row -->
                  <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                      <UIcon name="i-lucide-user" class="size-4 text-muted shrink-0" />
                      <span class="text-sm text-default">Username</span>
                    </div>
                    <UInput
                      v-model="settings.username.value"
                      size="xs"
                      variant="ghost"
                      class="w-28 text-right"
                      :ui="{ base: 'text-right text-sm text-dimmed' }"
                    />
                  </div>

                  <!-- Subscription row -->
                  <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                      <UIcon name="i-lucide-sparkles" class="size-4 text-muted shrink-0" />
                      <span class="text-sm text-default">Subscription</span>
                    </div>
                    <span class="text-sm text-dimmed">Free Plan</span>
                  </div>

                </div>
              </div>

              <!-- App section -->
              <div>
                <p class="text-xs font-medium text-dimmed px-1 mb-1.5 uppercase tracking-wide">App</p>
                <div class="bg-elevated rounded-xl overflow-hidden divide-y divide-[var(--ui-border-muted)]">
                  <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                      <UIcon name="i-lucide-moon" class="size-4 text-muted shrink-0" />
                      <span class="text-sm text-default">Appearance</span>
                    </div>
                    <span class="text-sm text-dimmed">System</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- LOGIN PAGE -->
        <Transition name="slide-right">
          <div v-if="currentPage === 'login'" class="flex flex-col max-h-[80vh] overflow-y-auto">
            <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
              <button
                class="size-9 rounded-full bg-elevated flex items-center justify-center text-default hover:brightness-125 transition-all"
                @click="currentPage = 'main'"
              >
                <UIcon name="i-lucide-chevron-left" class="size-[18px]" />
              </button>
              <span class="font-bold text-base text-default">Log in</span>
              <div class="size-9" />
            </div>

            <div class="px-6 pb-6 pt-2 space-y-4">
              <!-- Email + password -->
              <div class="space-y-3">
                <div>
                  <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Email</label>
                  <UInput
                    v-model="loginEmail"
                    type="email"
                    placeholder="you@example.com"
                    class="w-full"
                    autocomplete="email"
                    @keydown.enter="handleLogin"
                  />
                </div>
                <div class="group/login-pw">
                  <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Password</label>
                  <UInput
                    v-model="loginPassword"
                    :type="loginShowPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full"
                    autocomplete="current-password"
                    :ui="{ trailing: 'pe-1' }"
                    @keydown.enter="handleLogin"
                  >
                    <template #trailing>
                      <UButton
                        :icon="loginShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                        variant="link"
                        color="neutral"
                        size="sm"
                        class="opacity-0 group-hover/login-pw:opacity-40 hover:!opacity-70 transition-opacity"
                        :aria-label="loginShowPassword ? 'Hide password' : 'Show password'"
                        @click="loginShowPassword = !loginShowPassword"
                      />
                    </template>
                  </UInput>
                </div>
              </div>

              <button
                class="w-full py-2.5 rounded-xl bg-[var(--ui-color-primary-500)] text-white text-sm font-medium hover:bg-[var(--ui-color-primary-600)] transition-colors disabled:opacity-50"
                :disabled="loginLoading || !loginEmail.trim() || !loginPassword"
                @click="handleLogin"
              >
                {{ loginLoading ? 'Logging in...' : 'Log in' }}
              </button>

              <div class="flex items-center gap-3">
                <div class="flex-1 h-px bg-[var(--ui-border-muted)]" />
                <span class="text-xs text-dimmed">or</span>
                <div class="flex-1 h-px bg-[var(--ui-border-muted)]" />
              </div>

              <!-- Google auth -->
              <button
                class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-elevated text-sm font-medium text-default hover:brightness-125 transition-all"
                :disabled="loginLoading"
                @click="handleGoogleLogin"
              >
                <svg class="size-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <p class="text-center text-xs text-dimmed">
                Don't have an account?
                <button class="text-primary hover:underline font-medium" @click="openSignup">
                  Sign up
                </button>
              </p>
            </div>
          </div>
        </Transition>

        <!-- SIGNUP PAGE -->
        <Transition name="slide-right">
          <div v-if="currentPage === 'signup'" class="flex flex-col max-h-[80vh] overflow-y-auto">
            <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
              <button
                class="size-9 rounded-full bg-elevated flex items-center justify-center text-default hover:brightness-125 transition-all"
                @click="currentPage = 'login'"
              >
                <UIcon name="i-lucide-chevron-left" class="size-[18px]" />
              </button>
              <span class="font-bold text-base text-default">Sign up</span>
              <div class="size-9" />
            </div>

            <div class="px-6 pb-6 pt-2 space-y-4">
              <!-- Email + password + confirm -->
              <div class="space-y-3">
                <div>
                  <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Email</label>
                  <UInput
                    v-model="signupEmail"
                    type="email"
                    placeholder="you@example.com"
                    class="w-full"
                    autocomplete="email"
                    @keydown.enter="handleSignup"
                  />
                </div>
                <div class="group/signup-pw">
                  <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Password</label>
                  <UInput
                    v-model="signupPassword"
                    :type="signupShowPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full"
                    autocomplete="new-password"
                    :ui="{ trailing: 'pe-1' }"
                    @keydown.enter="handleSignup"
                  >
                    <template #trailing>
                      <UButton
                        :icon="signupShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                        variant="link"
                        color="neutral"
                        size="sm"
                        class="opacity-0 group-hover/signup-pw:opacity-40 hover:!opacity-70 transition-opacity"
                        :aria-label="signupShowPassword ? 'Hide password' : 'Show password'"
                        @click="signupShowPassword = !signupShowPassword"
                      />
                    </template>
                  </UInput>
                </div>
                <div class="group/signup-cpw">
                  <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Confirm Password</label>
                  <UInput
                    v-model="signupConfirmPassword"
                    :type="signupShowPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    class="w-full"
                    autocomplete="new-password"
                    :ui="{ trailing: 'pe-1' }"
                    @keydown.enter="handleSignup"
                  >
                    <template #trailing>
                      <UButton
                        :icon="signupShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                        variant="link"
                        color="neutral"
                        size="sm"
                        class="opacity-0 group-hover/signup-cpw:opacity-40 hover:!opacity-70 transition-opacity"
                        :aria-label="signupShowPassword ? 'Hide password' : 'Show password'"
                        @click="signupShowPassword = !signupShowPassword"
                      />
                    </template>
                  </UInput>
                  <p
                    v-if="signupConfirmPassword && signupPassword !== signupConfirmPassword"
                    class="text-xs text-[var(--ui-color-error-500)] mt-1 px-1"
                  >
                    Passwords do not match
                  </p>
                </div>
              </div>

              <button
                class="w-full py-2.5 rounded-xl bg-[var(--ui-color-primary-500)] text-white text-sm font-medium hover:bg-[var(--ui-color-primary-600)] transition-colors disabled:opacity-50"
                :disabled="signupLoading || !signupEmail.trim() || !signupPassword || signupPassword !== signupConfirmPassword"
                @click="handleSignup"
              >
                {{ signupLoading ? 'Creating account...' : 'Create account' }}
              </button>

              <div class="flex items-center gap-3">
                <div class="flex-1 h-px bg-[var(--ui-border-muted)]" />
                <span class="text-xs text-dimmed">or</span>
                <div class="flex-1 h-px bg-[var(--ui-border-muted)]" />
              </div>

              <!-- Google auth -->
              <button
                class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-elevated text-sm font-medium text-default hover:brightness-125 transition-all"
                :disabled="signupLoading"
                @click="handleGoogleLogin"
              >
                <svg class="size-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <p class="text-center text-xs text-dimmed">
                Already have an account?
                <button class="text-primary hover:underline font-medium" @click="openLogin">
                  Log in
                </button>
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
  position: absolute;
  width: 100%;
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Keep content in flow when not transitioning */
.slide-left-enter-to,
.slide-left-leave-from,
.slide-right-enter-to,
.slide-right-leave-from {
  position: relative;
  transform: translateX(0);
  opacity: 1;
}
</style>
