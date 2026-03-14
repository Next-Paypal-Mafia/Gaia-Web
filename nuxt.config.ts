export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxtjs/supabase'],

  supabase: {
    redirect: false,
  },

  css: ['~/assets/css/main.css'],

})
