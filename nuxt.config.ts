export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxtjs/supabase'],

  runtimeConfig: {
    public: {
      serverUrl: process.env.SERVER_URL || '',
    },
  },

  supabase: {
    redirect: false,
  },

  css: ['~/assets/css/main.css'],

})
