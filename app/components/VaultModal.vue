<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{
      content: 'max-w-4xl w-full max-h-[85vh] overflow-hidden rounded-2xl bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-2xl',
      overlay: 'backdrop-blur-md bg-white/40 dark:bg-black/40',
      body: 'p-0 sm:p-0 h-full min-h-[70vh]',
      header: 'hidden',
      footer: 'hidden',
    }"
  >
    <template #body>
      <Transition name="vault-slide">
        <VaultPanel v-model:open="open" class="min-h-[70vh]" />
      </Transition>
    </template>
  </UModal>
</template>

<style scoped>
.vault-slide-enter-active,
.vault-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.vault-slide-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.vault-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
