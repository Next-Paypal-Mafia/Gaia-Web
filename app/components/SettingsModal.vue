<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const settings = useSettings()
const toast = useToast()

type Page = 'main' | 'login' | 'signup' | 'verify'
const transitionName = ref('slide-left')
const currentPage = ref<Page>('main')

function setPage(page: Page) {
  if (page === 'main' || (currentPage.value === 'signup' && page === 'login') || (currentPage.value === 'verify' && page === 'login')) {
    transitionName.value = 'slide-right'
  } else {
    transitionName.value = 'slide-left'
  }
  currentPage.value = page
}

const loginEmail = ref('')
const loginPassword = ref('')
const loginShowPassword = ref(false)
const loginLoading = ref(false)
const loginError = ref('')

const signupEmail = ref('')
const signupPassword = ref('')
const signupConfirmPassword = ref('')
const signupShowPassword = ref(false)
const signupLoading = ref(false)
const signupError = ref('')

const verifyEmail = ref('')
const resendLoading = ref(false)

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
      setPage('main')
      resetForms()
    }, 250)
  }
})

function resetForms() {
  loginEmail.value = ''
  loginPassword.value = ''
  loginShowPassword.value = false
  loginLoading.value = false
  loginError.value = ''
  signupEmail.value = ''
  signupPassword.value = ''
  signupConfirmPassword.value = ''
  signupShowPassword.value = false
  signupLoading.value = false
  signupError.value = ''
}

function openLogin() {
  resetForms()
  setPage('login')
}

function openSignup() {
  resetForms()
  setPage('signup')
}

async function handleLogin() {
  if (!loginEmail.value.trim() || !loginPassword.value) return
  const supabase = useSupabaseClient()
  loginLoading.value = true
  loginError.value = ''
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    })
    if (error) throw error
    resetForms()
    setPage('main')
  } catch (e: any) {
    loginError.value = e?.message || 'Could not sign in'
  } finally {
    loginLoading.value = false
  }
}

async function handleSignup() {
  if (!signupEmail.value.trim() || !signupPassword.value) return
  if (signupPassword.value !== signupConfirmPassword.value) {
    signupError.value = 'Passwords do not match'
    return
  }
  if (signupPassword.value.length < 6) {
    signupError.value = 'Password must be at least 6 characters'
    return
  }
  const supabase = useSupabaseClient()
  signupLoading.value = true
  signupError.value = ''
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.value.trim(),
      password: signupPassword.value,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) throw error

    if (data.session) {
      resetForms()
      setPage('main')
    } else {
      verifyEmail.value = signupEmail.value.trim()
      setPage('verify')
    }
  } catch (e: any) {
    signupError.value = e?.message || 'Could not create account'
  } finally {
    signupLoading.value = false
  }
}

async function handleResendVerification() {
  if (!verifyEmail.value.trim()) return
  const supabase = useSupabaseClient()
  resendLoading.value = true
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: verifyEmail.value.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    if (error) throw error
    toast.add({
      title: 'Email sent',
      description: 'Check your inbox for the verification link.',
      icon: 'i-lucide-mail-check',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: 'Could not resend',
      description: e?.message || 'Please try again later.',
      icon: 'i-lucide-alert-circle',
      color: 'error',
    })
  } finally {
    resendLoading.value = false
  }
}

async function handleGoogleLogin() {
  const supabase = useSupabaseClient()
  loginLoading.value = true
  loginError.value = ''
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
    // Do not redirect UI manually, let browser navigate
  } catch (e: any) {
    toast.add({
      title: 'Sign in failed',
      description: e?.message || 'Could not sign in with Google',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
    loginLoading.value = false
  }
}

async function handleLogout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  window.location.reload()
}
</script>

<template>
<UModal v-model:open="open" :ui="{
  content: 'max-w-96 overflow-hidden bg-white/80 dark:bg-white/3 backdrop-blur-2xl border border-black/6 dark:border-white/10 rounded-2xl shadow-2xl',
  overlay: 'backdrop-blur-md bg-white/40 dark:bg-black/40',
  header: 'hidden',
  footer: 'hidden',
}">
  <template #body>
    <div class="relative overflow-hidden">
      <!-- ═══ MAIN PAGE ═══ -->
      <Transition :name="transitionName">
        <div v-if="currentPage === 'main'" class="flex flex-col max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
            <div class="size-9" />
            <span class="font-bold text-base text-default">Settings</span>
            <button
              class="size-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-default hover:brightness-125 transition-all"
              @click="open = false">
              <UIcon name="i-lucide-x" class="size-4.5" />
            </button>
          </div>

          <div class="flex flex-col items-center px-6 pb-6 pt-1 shrink-0">
            <div v-if="settings.profilePicture.value"
              class="size-18 rounded-full mb-3 shrink-0 overflow-hidden ring-2 ring-muted">
              <img :src="settings.profilePicture.value" :alt="settings.username.value" class="size-full object-cover" />
            </div>
            <div v-else
              class="size-18 rounded-full flex items-center justify-center mb-3 bg-primary text-white font-bold text-2xl shrink-0">
              {{ initials }}
            </div>
            <h2 class="text-xl font-semibold text-default">{{ settings.username.value }}</h2>
            <span class="text-xs text-dimmed mt-0.5">Free plan</span>

            <button v-if="!settings.isLoggedIn.value"
              class="mt-3 px-5 py-1.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              @click="openLogin">
              Log in
            </button>
            <button v-else
              class="mt-3 px-5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 text-sm font-medium text-muted hover:brightness-125 transition-colors"
              @click="handleLogout">
              Log out
            </button>
          </div>

          <div class="px-4 pb-6 space-y-4">
            <div>
              <p class="text-xs font-medium text-dimmed px-1 mb-1.5 uppercase tracking-wide">Account</p>
              <div
                class="bg-black/2 dark:bg-white/3 rounded-xl overflow-hidden divide-y divide-black/6 dark:divide-white/6 border border-black/6 dark:border-white/10">
                <div class="flex items-center justify-between px-4 py-3">
                  <div class="flex items-center gap-3">
                    <UIcon name="i-lucide-user" class="size-4 text-muted shrink-0" />
                    <span class="text-sm text-default">Username</span>
                  </div>
                  <UInput v-model="settings.username.value" size="xs" variant="ghost" class="w-28 text-right"
                    :ui="{ base: 'text-right text-sm text-dimmed' }" />
                </div>
                <div class="flex items-center justify-between px-4 py-3">
                  <div class="flex items-center gap-3">
                    <UIcon name="i-lucide-sparkles" class="size-4 text-muted shrink-0" />
                    <span class="text-sm text-default">Subscription</span>
                  </div>
                  <span class="text-sm text-dimmed">Free Plan</span>
                </div>
              </div>
            </div>

            <div>
              <p class="text-xs font-medium text-dimmed px-1 mb-1.5 uppercase tracking-wide">App</p>
              <div
                class="bg-black/2 dark:bg-white/3 rounded-xl overflow-hidden divide-y divide-black/6 dark:divide-white/6 border border-black/6 dark:border-white/10">
                <div class="flex items-center justify-between px-4 py-3 gap-3">
                  <div class="flex items-center gap-3 shrink-0">
                    <UIcon name="i-lucide-palette" class="size-4 text-muted shrink-0" />
                    <span class="text-sm text-default">Appearance</span>
                  </div>
                  <ClientOnly>
                    <UColorModeSelect size="xs" variant="ghost" color="neutral" :ui="{ base: 'text-sm text-dimmed' }" />
                    <template #fallback>
                      <span class="text-sm text-dimmed">System</span>
                    </template>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ═══ LOGIN PAGE ═══ -->
      <Transition :name="transitionName">
        <div v-if="currentPage === 'login'" class="flex flex-col max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
            <button
              class="size-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-default hover:brightness-125 transition-all"
              @click="setPage('main')">
              <UIcon name="i-lucide-chevron-left" class="size-4.5" />
            </button>
            <span class="font-bold text-base text-default">Log in</span>
            <div class="size-9" />
          </div>

          <div class="px-6 pb-6 pt-2 space-y-4">
            <div class="space-y-3">
              <div>
                <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Email</label>
                <UInput v-model="loginEmail" type="email" placeholder="you@example.com" class="w-full"
                  autocomplete="email" @keydown.enter="handleLogin" />
              </div>
              <div class="group/login-pw">
                <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Password</label>
                <UInput v-model="loginPassword" :type="loginShowPassword ? 'text' : 'password'" placeholder="••••••••"
                  class="w-full" autocomplete="current-password" :ui="{ trailing: 'pe-1' }"
                  @keydown.enter="handleLogin">
                  <template #trailing>
                    <UButton :icon="loginShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" variant="link"
                      color="neutral" size="sm"
                      class="opacity-0 group-hover/login-pw:opacity-40 hover:opacity-70! transition-opacity"
                      :aria-label="loginShowPassword ? 'Hide password' : 'Show password'"
                      @click="loginShowPassword = !loginShowPassword" />
                  </template>
                </UInput>
              </div>
            </div>

            <p v-if="loginError" class="text-xs text-error-500 px-1">
              {{ loginError }}
            </p>

            <button
              class="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              :disabled="loginLoading || !loginEmail.trim() || !loginPassword" @click="handleLogin">
              {{ loginLoading ? 'Logging in...' : 'Log in' }}
            </button>

            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-black/8 dark:bg-white/8" />
              <span class="text-xs text-dimmed">or</span>
              <div class="flex-1 h-px bg-black/8 dark:bg-white/8" />
            </div>

            <button
              class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium text-default hover:brightness-125 transition-all disabled:opacity-50 border border-black/6 dark:border-white/10"
              :disabled="loginLoading" @click="handleGoogleLogin">
              <svg class="size-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

      <!-- ═══ SIGNUP PAGE ═══ -->
      <Transition :name="transitionName">
        <div v-if="currentPage === 'signup'" class="flex flex-col max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
            <button
              class="size-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-default hover:brightness-125 transition-all"
              @click="setPage('login')">
              <UIcon name="i-lucide-chevron-left" class="size-4.5" />
            </button>
            <span class="font-bold text-base text-default">Sign up</span>
            <div class="size-9" />
          </div>

          <div class="px-6 pb-6 pt-2 space-y-4">
            <div class="space-y-3">
              <div>
                <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Email</label>
                <UInput v-model="signupEmail" type="email" placeholder="you@example.com" class="w-full"
                  autocomplete="email" @keydown.enter="handleSignup" />
              </div>
              <div class="group/signup-pw">
                <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Password</label>
                <UInput v-model="signupPassword" :type="signupShowPassword ? 'text' : 'password'" placeholder="••••••••"
                  class="w-full" autocomplete="new-password" :ui="{ trailing: 'pe-1' }" @keydown.enter="handleSignup">
                  <template #trailing>
                    <UButton :icon="signupShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" variant="link"
                      color="neutral" size="sm"
                      class="opacity-0 group-hover/signup-pw:opacity-40 hover:opacity-70! transition-opacity"
                      :aria-label="signupShowPassword ? 'Hide password' : 'Show password'"
                      @click="signupShowPassword = !signupShowPassword" />
                  </template>
                </UInput>
              </div>
              <div class="group/signup-cpw">
                <label class="text-xs font-medium text-dimmed px-1 mb-1 block">Confirm password</label>
                <UInput v-model="signupConfirmPassword" :type="signupShowPassword ? 'text' : 'password'"
                  placeholder="••••••••" class="w-full" autocomplete="new-password" :ui="{ trailing: 'pe-1' }"
                  @keydown.enter="handleSignup">
                  <template #trailing>
                    <UButton :icon="signupShowPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" variant="link"
                      color="neutral" size="sm"
                      class="opacity-0 group-hover/signup-cpw:opacity-40 hover:opacity-70! transition-opacity"
                      :aria-label="signupShowPassword ? 'Hide password' : 'Show password'"
                      @click="signupShowPassword = !signupShowPassword" />
                  </template>
                </UInput>
                <p v-if="signupConfirmPassword && signupPassword !== signupConfirmPassword"
                  class="text-xs text-error-500 mt-1 px-1">
                  Passwords do not match
                </p>
              </div>
            </div>

            <p v-if="signupError" class="text-xs text-error-500 px-1">
              {{ signupError }}
            </p>

            <button
              class="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              :disabled="signupLoading || !signupEmail.trim() || !signupPassword || signupPassword !== signupConfirmPassword"
              @click="handleSignup">
              {{ signupLoading ? 'Creating account...' : 'Create account' }}
            </button>

            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-black/8 dark:bg-white/8" />
              <span class="text-xs text-dimmed">or</span>
              <div class="flex-1 h-px bg-black/8 dark:bg-white/8" />
            </div>

            <button
              class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium text-default hover:brightness-125 transition-all disabled:opacity-50 border border-black/6 dark:border-white/10"
              :disabled="signupLoading" @click="handleGoogleLogin">
              <svg class="size-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

      <!-- ═══ EMAIL VERIFICATION PAGE ═══ -->
      <Transition :name="transitionName">
        <div v-if="currentPage === 'verify'" class="flex flex-col max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
            <button
              class="size-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-default hover:brightness-125 transition-all"
              @click="setPage('login')">
              <UIcon name="i-lucide-chevron-left" class="size-4.5" />
            </button>
            <span class="font-bold text-base text-default">Verify email</span>
            <div class="size-9" />
          </div>

          <div class="flex flex-col items-center px-6 pb-8 pt-4 text-center">
            <div class="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <UIcon name="i-lucide-mail-check" class="size-8 text-primary" />
            </div>
            <h3 class="text-lg font-semibold text-default mb-1.5">Check your inbox</h3>
            <p class="text-sm text-muted leading-relaxed max-w-70">
              We sent a verification link to
              <span class="font-medium text-default">{{ verifyEmail }}</span>.
              Click the link to activate your account.
            </p>

            <div class="mt-6 space-y-3 w-full max-w-60">
              <button
                class="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                :disabled="resendLoading" @click="handleResendVerification">
                {{ resendLoading ? 'Sending...' : 'Resend email' }}
              </button>
              <button
                class="w-full py-2 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium text-muted hover:brightness-125 transition-colors"
                @click="openLogin">
                Back to log in
              </button>
            </div>

            <p class="text-[11px] text-dimmed mt-6 leading-relaxed max-w-64">
              Didn't receive anything? Check your spam folder or try a different email address.
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
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.slide-left-enter-to,
.slide-left-leave-from,
.slide-right-enter-to,
.slide-right-leave-from {
  position: relative;
  transform: translateX(0);
  opacity: 1;
}
</style>
