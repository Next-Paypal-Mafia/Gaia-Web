<script setup lang="ts">
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
    toast.add({ title: "Fill in all fields", color: "warning" })
    return
  }
  submitting.value = true
  try {
    await $fetch("/api/bug-report", {
      method: "POST",
      body: { email: em, title: ti, description: desc },
    })
    toast.add({ title: "Report sent — thank you!", color: "success" })
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
      ?? "Could not send. Check configuration or try again."
    toast.add({ title: "Could not send report", description: msg, color: "error" })
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
      aria-label="Report a bug"
      @click="open = true"
    >
      <UIcon name="i-lucide-bug" class="size-4 shrink-0" />
      Report bug
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
                Help us improve
              </p>
              <h2 class="text-lg font-semibold text-default mt-0.5">
                Report a bug
              </h2>
              <p class="text-xs text-muted mt-1">
                This goes to the team at team@jellybyte.io
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-default hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              aria-label="Close"
              @click="open = false"
            >
              <UIcon name="i-lucide-x" class="size-4.5" />
            </button>
          </div>

          <form class="space-y-3" @submit.prevent="onSubmit">
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-email">Your email</label>
              <UInput
                id="bug-report-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-title">Title</label>
              <UInput
                id="bug-report-title"
                v-model="title"
                placeholder="Short summary"
                maxlength="200"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-dimmed mb-1.5 block" for="bug-report-desc">Description</label>
              <UTextarea
                id="bug-report-desc"
                v-model="description"
                placeholder="What happened? Steps to reproduce?"
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
                Cancel
              </UButton>
              <UButton
                type="submit"
                :loading="submitting"
                class="flex-1"
              >
                Submit
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
