export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },
  devServer: {
    port: 3001,
  },

  modules: ["@nuxt/ui", "@nuxtjs/supabase"],

  runtimeConfig: {
    public: {
      agentApiUrl: "",
    },
  },

  supabase: {
    redirect: false,
  },

  css: ["~/assets/css/main.css"],
});
