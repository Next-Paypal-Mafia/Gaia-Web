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
      /** Agent / OpenCode backend (e.g. http://localhost:8000). Set SERVER_URL or NUXT_PUBLIC_SERVER_URL in .env */
      serverUrl:
        process.env.NUXT_PUBLIC_SERVER_URL ||
        process.env.SERVER_URL ||
        "",
    },
  },

  supabase: {
    redirect: false,
  },

  css: ["~/assets/css/main.css"],
});
