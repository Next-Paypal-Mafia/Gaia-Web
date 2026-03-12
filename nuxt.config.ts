export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxtjs/supabase'],

  supabase: {
    redirect: false,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    googleGenerativeAiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    chromeDebugPort: process.env.CHROME_DEBUG_PORT || '9222',
  },
})
