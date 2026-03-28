<script setup lang="ts">
useUserLocationReporting()

const { t, locale, localeProperties } = useI18n()

const htmlLang = computed(() => {
  const lp = localeProperties.value as { language?: string }
  return lp.language ?? locale.value
})

const docTitle = computed(() => t("meta.title"))
const docDescription = computed(() => t("meta.description"))

useHead({
  title: docTitle,
  htmlAttrs: {
    lang: htmlLang,
  },
})

useSeoMeta({
  description: docDescription,
  ogTitle: docTitle,
  ogDescription: docDescription,
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
