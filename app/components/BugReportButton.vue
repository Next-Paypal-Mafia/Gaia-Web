<script setup lang="ts">
const { t } = useI18n()
const open = ref(false)
const email = ref("")
const title = ref("")
const description = ref("")
const submitting = ref(false)

const supabase = useSupabaseClient()
const toast = useToast()

watch(open, async (isOpen) => {
  if (!isOpen) return
  submitting.value = false
  title.value = ""
  description.value = ""
  const { data: { user } } = await supabase.auth.getUser()
  email.value = user?.email?.trim() ?? ""
})

async function onSubmit() {
  const em = email.value.trim()
  const ti = title.value.trim()
  const desc = description.value.trim()
  if (!em || !ti || !desc) {
    toast.add({ title: t("bug_report.toast_fill_fields"), color: "warning" })
    return
  }
  submitting.value = true
  try {
    await $fetch("/api/bug-report", {
      method: "POST",
      body: { email: em, title: ti, description: desc },
    })
    toast.add({ title: t("bug_report.toast_sent"), color: "success" })
    open.value = false
  }
  catch (e: unknown) {
    const err = e as {
      data?: { message?: string; statusMessage?: string }
      statusMessage?: string
      message?: string
    }
    const msg =
      err?.data?.statusMessage
      ?? err?.data?.message
      ?? err?.statusMessage
      ?? err?.message
      ?? t("bug_report.toast_error_fallback")
    toast.add({ title: t("bug_report.toast_error_title"), description: msg, color: "error" })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-2 pointer-events-none">
    <button
      type="button"
      class="pointer-events-auto flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 text-sm font-medium text-white bg-primary shadow-lg shadow-primary/25 border border-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all"
      :aria-label="t('bug_report.button_aria')"
      @click="open = true"
    >
      <UIcon name="i-lucide-bug" class="size-4 shrink-0" />
      {{ t("bug_report.button") }}
    </button>

    <UModal
      v-model:open="open"
      :ui="{
        content:
          'max-w-md w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10',
        overlay: 'bg-black/45 dark:bg-black/55',
        header: 'hidden',
        footer: 'hidden',
      }"
    >
      <template #body>
        <div class="p-5 sm:p-6 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                {{ t("bug_report.kicker") }}
              </p>
              <h2 class="text-lg font-semibold text-default mt-0.5">
                {{ t("bug_report.title") }}
              </h2>
              <p class="text-xs text-muted mt-1">
                {{ t("bug_report.subtitle") }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-default hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              :aria-label="t('bug_report.close_aria')"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="size-[18px]" />
            </button>
          </div>

          <form class="space-y-3" @submit.prevent="onSubmit">
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-email">{{ t("bug_report.email_label") }}</label>
              <UInput
                id="bug-report-email"
                v-model="email"
                type="email"
                :placeholder="t('bug_report.email_placeholder')"
                autocomplete="email"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-title">{{ t("bug_report.title_label") }}</label>
              <UInput
                id="bug-report-title"
                v-model="title"
                :placeholder="t('bug_report.title_placeholder')"
                maxlength="200"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-desc">{{ t("bug_report.description_label") }}</label>
              <UTextarea
                id="bug-report-desc"
                v-model="description"
                :placeholder="t('bug_report.description_placeholder')"
                :rows="4"
                autoresize
                :maxrows="12"
                class="w-full"
              />
            </div>
            <div class="flex gap-2 pt-1">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                class="flex-1"
                @click="open = false"
              >
                {{ t("bug_report.cancel") }}
              </UButton>
              <UButton
                type="submit"
                :loading="submitting"
                class="flex-1"
              >
                {{ t("bug_report.submit") }}
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
