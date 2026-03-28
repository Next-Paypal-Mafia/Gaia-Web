<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()
const show = ref(false)
const targetLocale = ref("")

const targetLocaleName = computed(() => {
  const code = targetLocale.value
  const list = locales.value as { code?: string; name?: string }[]
  const entry = list.find((l) => typeof l === "object" && l?.code === code)
  return entry?.name ?? code
})

onMounted(() => {
  // Simple check for system language mismatch
  const sysLang = (navigator.language || 'en').split("-")[0]
  const currentLocale = locale.value
  
  // Only suggest if it's a supported locale and NOT the current one
  const supported = (locales.value as any[]).find(l => l.code === sysLang)
  
  if (supported && sysLang !== currentLocale) {
    // Check if user already dismissed this one (optional, could use a cookie)
    const dismissed = localStorage.getItem(`i18n_dismissed_${sysLang}`)
    if (!dismissed) {
      targetLocale.value = sysLang
      // Delay slightly for better entrance
      setTimeout(() => {
        show.value = true
      }, 2000)
    }
  }
})

function handleSwitch() {
  setLocale(targetLocale.value)
  show.value = false
}

function handleDismiss() {
  localStorage.setItem(`i18n_dismissed_${targetLocale.value}`, "true")
  show.value = false
}
</script>

<template>
  <Transition name="prompt-pop">
    <div v-if="show" class="fixed bottom-6 right-6 z-[100] w-72">
      <div class="glass-jelly p-5 rounded-2xl shadow-2xl border border-primary/20 space-y-4">
        <div class="flex items-start gap-3">
          <div class="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-languages" class="size-5 text-primary" />
          </div>
          <div>
            <p class="text-sm font-semibold text-default">{{ t('language_prompt') }}</p>
            <p class="text-xs text-dimmed mt-1">{{ targetLocaleName }}</p>
          </div>
        </div>
        
        <div class="flex gap-2">
          <UButton
            color="primary"
            variant="solid"
            size="xs"
            class="flex-1 font-medium"
            @click="handleSwitch"
          >
            {{ t('switch') }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            class="flex-1 font-medium"
            @click="handleDismiss"
          >
            {{ t('keep') }}
          </UButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.prompt-pop-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.prompt-pop-leave-active {
  transition: all 0.3s ease-in;
}
.prompt-pop-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.prompt-pop-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
